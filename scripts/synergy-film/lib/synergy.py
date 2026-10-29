"""Synergy: the deadpan robot host of the LinkedIn Beats office.

Procedural model + FK rig, built from nothing in Blender 4.5 (Cycles).

    import synergy as S
    rig = S.build(timeline=face.FaceTimeline(1, 96))
    rig.apply_preset(1, 'idle_cup')
    rig.pose(24, head=(0, 7, 0), interp='BEZIER')

Conventions (visual canon): metres, Z up, the character faces -Y, the
character's LEFT is +X. The armature origin sits on the floor between the
feet; the head apex is at 1.75 m. Every rigid part is its own mesh,
bone-parented (no skin weights). Head and torso plates are separate objects
with their origin at their own centroid (rig.head_plates / rig.torso_plates).

Pose controls (degrees). Tuples are (x, y, z), applied x then y then z, each
about an axis fixed in the parent's rest frame:
  centre chain  pelvis, spine, chest, neck, head
      x > 0 pitches forward/down, y > 0 rolls so the character's LEFT side
      (earcup side) goes up, z > 0 turns toward the character's left.
      Canonical head roll: head=(0, 7, 0).
  limbs  shoulder_*, upperarm_*, thigh_*  (and forearm_*/shin_*/foot_* as tuples)
      x > 0 swings the limb forward, y > 0 swings it outward (away from the
      body), z > 0 twists its front outward. L and R are mirrored, so equal
      values give a symmetric pose. shoulder_*: x forward, y shrug up.
  forearm_*  number = elbow flex (> 0 bends the forearm forward/up)
  shin_*     number = knee flex (> 0 bends the shin back)
  foot_*     number = ankle (> 0 lifts the toes)
  hand_*     (flex toward the palm, twist palm toward the pinky side,
              deviation toward the pinky side)
  fingers_*  curl 0..1 (all four fingers), or 'grip' (wrap the cup)
  thumb_*    curl 0..1, or 'grip', or 'up' (extended for a thumbs-up)
  root_loc   (x, y, z) world position of the point between the feet
  root_rot   world heading in degrees (0 = facing -Y)
  root_z     drop/raise the whole body (metres, keyed on the root's Z only)
  badge      (x, y, z) swing of the badge on its clip (centre convention)
  pauldron_* (x, y, z) extra pauldron lift; by default it follows half of the
             arm's sideways lift (clamped to 15 deg) and none of its forward swing.
Poses are keyed as bone quaternions (sign-continuous). Key poses first, then
call attach_cup / detach_headset / attach_headset (they read the posed rig).

Presets (rig.apply_preset(frame, name)):
  idle_cup       canon: cup in the right hand at chest height ~23 cm in front of
                 the chest, left arm relaxed, head rolled 5 deg (earcup side up)
  idle_cup_high  the approved plate: cup raised beside the head, forearm near
                 vertical, sharp wrist bend (hero framing)
  thumbs_up      idle cup + left fist with the thumb up in front of the chest
  sip            cup raised to just below the screen, head tipped to meet it
  reach_L        left hand reaching forward at table height, palm down
  hands_clasped  executive steeple in front of the chest (fingertips a few cm
                 apart). Needs both hands free: park the cup first with
                 attach_cup(frame, None). With canon proportions (0.52 m arm,
                 shoulders at +-0.31 m) the wrists cannot meet at the centre line
                 without the arms crossing the chest.
  seated         thighs/knees 88 deg, body dropped to a 0.40 m seat, cup held,
                 left hand resting on the thigh
  neutral        everything at rest
All presets (and walk()) are checked free of interpenetration (BVH overlap test),
apart from deliberate joint seats (hubs in sockets, piston stages, cable ends).

Props: the cup and the headset group are unparented objects driven by Child Of
constraints with keyed influence (cup: 'hold_R' / 'hold_L'; headset: 'on_head').
While detached, key their location/rotation_quaternion in world space.
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
except ImportError:  # imported as a package
    from . import common as C, face as F, materials as M

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
    'index': ((0.040, 0.030, 0.026), -0.0315, 0.097, -3.0),
    'middle': ((0.044, 0.032, 0.027), -0.0105, 0.099, 0.0),
    'ring': ((0.041, 0.030, 0.026), 0.0105, 0.097, 2.5),
    'pinky': ((0.034, 0.025, 0.022), 0.0315, 0.092, 6.0),
}
FINGER_R = 0.0073          # proximal segment radius (tapers to 0.0065)
FIST = (80.0, 90.0, 58.0)  # MCP / PIP / DIP at curl 1.0

# cup (canon): body 0.115 tall, r 0.030 -> 0.045, lid 0.018
CUP_H = 0.115
CUP_R0, CUP_R1 = 0.030, 0.045


def cup_radius(h):
    h = min(max(h, 0.0), CUP_H)
    return CUP_R0 + (CUP_R1 - CUP_R0) * h / CUP_H


# grip: cup placement in the hand frame (u along fingers, v toward pinky, w palm normal)
GRIP_U, GRIP_W = 0.086, 0.0575
GRIP_TILT = math.radians(16.0)   # fingers spiral slightly down the cup
GRIP_H_MID = 0.058               # cup height at the hand's centre line (index ~9 cm up the cup)


def grip_frame(W, u, v, w):
    """Cup axis and base centre for a hand frame (rest or posed)."""
    c = (-v * math.cos(GRIP_TILT) - u * math.sin(GRIP_TILT)).normalized()
    mid = W + u * GRIP_U + w * GRIP_W
    return c, mid - c * GRIP_H_MID


# canonical cup hold (right hand): cup in front of the shoulder, elbow tucked low
IDLE_CUP = dict(cup_base=V((-0.305, -0.40, 1.195)), finger_dir=V((0.1, -1.0, 0.0)), pole=V((-0.05, 0.0, -1.0)))

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

    def __init__(self):
        self.bm = bmesh.new()
        self.mats = []

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
        if bevel > 0:
            edges = list({e for v in r['verts'] for e in v.link_edges})
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
            edges = list({e for f in new for e in f.edges})
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
            cream=M.cream_enamel(0.65), cream_head=M.cream_enamel(0.7), grey=M.galvanized_grey(0.45),
            gun=M.gunmetal('inner'), gun_plate=M.gunmetal('plate'), chrome=M.chrome(), bronze=M.bronze('disc'),
            tip=M.bronze('tip'), rivet=M.rivet_steel(), core=M.dark_core(), black=M.black_plastic(),
            black_gloss=M.black_plastic(gloss=True), leather=M.leatherette(), rubber=M.rubber(),
            foam=M.mic_foam(), brass=M.brass(), copper=M.copper_wire(), red=M.red_wire(),
            orange=M.orange_wire(), strap=M.lanyard_strap(), card=M.badge_card(), vinyl=M.clear_vinyl(),
            clip=M.chrome_clip(), chip=M.blue_chip(), cup=M.paper_cup(), lid=M.cup_lid(),
        )

    # ---------------------------------------------------- registry
    def add(self, key, obj, bone):
        obj.name = f'{self.name}_{key}'
        self.parts[key] = obj
        self.later_parent.append((obj, bone))
        return obj

    def obj_from(self, key, mb, bone, origin=None, sharp=40.0):
        return self.add(key, mb.to_object(key, self.coll, origin=origin, sharp=sharp), bone)

    # ---------------------------------------------------- plates
    def plate(self, key, poly, outward, kind, bone, group=None, recess=None, thick=0.0025, gap=0.0013,
              rivets=True, reg='head', rivet_scale=1.0, spacing=0.042):
        poly = [V(p) for p in poly]
        n = newell(poly)
        if n.dot(V(outward)) < 0:
            poly.reverse()
            n = -n
        if len(poly) >= 4:
            cc = sum(poly, V()) / len(poly)
            warp = max(abs((q - cc).dot(n)) for q in poly)
            if warp > 0.0015:
                # split along the diagonal that bulges outward (keeps the shell convex)
                if len(poly) == 4:
                    mA = (poly[0] + poly[2]) / 2
                    mB = (poly[1] + poly[3]) / 2
                    if (mA - mB).dot(n) >= 0:
                        tris = [[poly[0], poly[1], poly[2]], [poly[0], poly[2], poly[3]]]
                    else:
                        tris = [[poly[1], poly[2], poly[3]], [poly[1], poly[3], poly[0]]]
                else:
                    tris = [[poly[0], poly[i], poly[i + 1]] for i in range(1, len(poly) - 1)]
                out = None
                for k, tri in enumerate(tris):
                    out = self.plate(f'{key}_{"abcdef"[k]}', tri, outward, kind, bone, group, recess, thick, gap,
                                     rivets, reg, rivet_scale, spacing)
                return out
        mat = {'cream': self.mat['cream'], 'cream_head': self.mat['cream_head'], 'grey': self.mat['grey'],
               'dark': self.mat['gun_plate']}[kind]
        if recess is None:
            recess = {'cream': 0.0, 'cream_head': 0.0, 'grey': 0.0015, 'dark': 0.001}[kind]
        pts = inset_poly(poly, n, gap / 2)
        pts = [p - n * recess for p in pts]
        mb = MB()
        mi_core = mb.mi(self.mat['core'])
        mb.prism(mat, pts, n, thick, bevel=0.0009)
        for f in mb.bm.faces:
            if f.normal.dot(n) < -0.95:
                f.material_index = mi_core
        if rivets:
            rp, rs = self.rivet_points(pts, n, reg, rivet_scale, spacing)
            if rp:
                mb.rivets(self.mat['rivet'], rp, n, rs)
        c = sum(pts, V()) / len(pts)
        obj = self.obj_from(key, mb, bone, origin=c)
        obj['plate_normal'] = tuple(n)
        obj['plate_kind'] = kind
        obj['plate_poly'] = [c for q in pts for c in q]
        if group is not None:
            group.append(obj)
        return obj

    def rivet_points(self, poly, n, reg, scale=1.0, spacing=0.048, inset=0.0072, min_dist=0.022):
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
            q = p1 + bis * (0.0105 / max(0.3, bis.dot(in1)))
            if inside(q, 0.0055) and free(q):
                pts.append(q)
                sizes.append((0.0038 * scale, 0.0021 * scale))
                regl.append(q)
        for a, b, m in edges:
            L = (b - a).length
            cnt = max(1, int(round(L / spacing)))
            for j in range(cnt):
                t = (j + 0.5) / cnt
                q = a.lerp(b, t) + m * inset
                hsh = math.sin(q.x * 1731.0 + q.y * 977.0 + q.z * 1313.0) * 43758.5453
                if hsh - math.floor(hsh) < 0.18:
                    continue  # a few rivets are missing
                if inside(q, 0.005) and free(q):
                    pts.append(q)
                    sizes.append((0.0031 * scale, 0.0018 * scale))
                    regl.append(q)
        return pts, sizes

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
        Fp = lambda s: L('JawR', 'Rtip', s)
        Q11 = (L('Rtip', 'apex', 0.5)).lerp(P['BK1'], 0.42)
        Mc = L('JawR', 'JawL', 0.5)
        plates = [
            # (key, poly, kind)
            ('crown_c', [P['BrowR'], P['BrowL'], P['apex']], 'cream_head'),
            ('crown_strip', [P['BrowR'], E(0.05), P['apex']], 'cream_head'),
            ('crown_tri', [E(0.38), P['Rtip'], P['apex']], 'cream_head'),
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
            ('crown_band', [E(0.05), E(0.38), P['apex']], 'grey'),
            ('cheek_grey', [P['JawR'], P['BrowR'], E(0.27), Fp(0.24)], 'grey'),
            ('chin_l', [Mc, P['JawL'], P['chin']], 'grey'),
            ('chin_left', [P['chin'], P['L2'], P['JawL']], 'grey'),
            ('top_back_g', [P['BK1'], P['Rtip'], Q11], 'grey'),
            ('back_d', [P['BK3'], P['BK2'], P['BK1']], 'grey'),
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
        self.face_frame = (c, ex, ey, n)
        Wf = (BL - BR).length - 0.0013
        Hf = up_raw.length - 0.0013
        sw, sh = 0.190 * HEAD_SCALE, 0.135 * HEAD_SCALE
        k = 6

        def to3(x, y, z):
            return c + ex * x + ey * y + n * z

        outer = rrect2d(Wf, Hf, 0.0012, k)
        inner = rrect2d(sw, sh, 0.006 * HEAD_SCALE, k)
        zf, zbo, zbi, zg = 0.004, -0.0025, -0.0036, -0.001
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
        mb.bm = bm
        mb.mi(self.mat['cream_head'])
        # bezel rivets at corners and edge midpoints
        bw, bh = (Wf - sw) / 2, (Hf - sh) / 2
        rx, ry = Wf / 2 - bw / 2, Hf / 2 - bh / 2
        rpts = [to3(x, y, zf) for x, y in ((rx, ry), (-rx, ry), (rx, -ry), (-rx, -ry), (0, ry), (0, -ry),
                                           (rx, 0), (-rx, 0))]
        mb.rivets(self.mat['rivet'], rpts, n, [(0.0033, 0.0019)] * len(rpts))
        self.rivet_reg.setdefault('head', []).extend(rpts)
        bez = self.obj_from('head_bezel', mb, 'head', origin=c)
        bez['plate_normal'] = tuple(n)
        bez['plate_kind'] = 'cream_head'
        self.head_plates.append(bez)
        # glass
        bm = bmesh.new()
        ring = [bm.verts.new(to3(x, y, zg)) for x, y in inner]
        cv = bm.verts.new(to3(0, 0, zg))
        uvl = bm.loops.layers.uv.new('UVMap')
        uvmap = {cv: (0.5, 0.5)}
        for v, (x, y) in zip(ring, inner):
            uvmap[v] = ((x + sw / 2) / sw, (y + sh / 2) / sh)
        for i in range(len(ring)):
            f = bm.faces.new((cv, ring[i], ring[(i + 1) % len(ring)]))
            for loop in f.loops:
                loop[uvl].uv = uvmap[loop.vert]
        bm.normal_update()
        for f in bm.faces:
            if f.normal.dot(n) < 0:
                f.normal_flip()
        me = bpy.data.meshes.new('screen')
        bm.to_mesh(me)
        bm.free()
        me.transform(Matrix.Translation(-c))
        tl = self.timeline
        smat = F.screen_material(tl, name=f'{self.name}_screen')
        for nd in smat.node_tree.nodes:
            if nd.type == 'BSDF_PRINCIPLED' and abs(nd.inputs['Roughness'].default_value - 0.4) < 1e-6 \
                    and not nd.inputs['Roughness'].is_linked:
                nd.inputs['Roughness'].default_value = 0.18
                nd.inputs['Specular IOR Level'].default_value = 0.3
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
        mb = MB()
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
            mb.lathe(m['black'], prof, o, a, seg=48, close_bottom=True)
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
        oR = seat(H((-0.165, 0.14, 0.15)) - axR * 0.025, axR)
        cupR = earcup(oR, axR, V((0, 0.4, 1)), 'R')
        self.earcups = (cupL, cupR)
        # headband: flat band over the crown behind the apex, flat side facing the head
        ctrl = [cupL['top'], H((0.232, 0.012, 0.280)), H((0.14, 0.032, 0.345)), H((0.02, 0.055, 0.350)),
                H((-0.13, 0.11, 0.28)), cupR['top']]
        ctrl = [ctrl[0]] + [hull.push(p, 0.0105) for p in ctrl[1:-1]] + [ctrl[-1]]
        path = spline_pts(ctrl, 14)
        path = [path[0]] + [hull.push(p, 0.0095) if 0 < i < len(path) - 1 else p for i, p in enumerate(path[1:], 1)]
        nrm = [(p - self.head_center).normalized() for p in path]
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
        # A-frame pistons (chest -> head) and back rods
        for sx in (-1, 1):
            s = 'L' if sx > 0 else 'R'
            self.piston(f'neck_piston_{s}', V((0.08 * sx, -0.08, 1.305)), 'chest',
                        V((0.032 * sx, -0.032, top.z - 0.012)), 'head', 0.011, 0.0062)
            self.piston(f'neck_rod_{s}', V((0.03 * sx, 0.055, 1.30)), 'chest',
                        V((0.022 * sx, 0.06, top.z - 0.006)), 'head', 0.0055, 0.0034, cyl_mat='gun')
        # brackets under the piston bases
        mb = MB()
        for sx in (-1, 1):
            mb.box(m['gun'], V((0.08 * sx, -0.08, 1.285)), (0.03, 0.03, 0.045), bevel=0.002)
            mb.cylinder(m['chrome'], V((0.08 * sx - 0.016, -0.08, 1.304)), V((0.08 * sx + 0.016, -0.08, 1.304)),
                        0.006, seg=12)
            mb.box(m['gun'], V((0.03 * sx, 0.055, 1.285)), (0.02, 0.02, 0.04), bevel=0.002)
        # collar cavity: gears and a servo
        for c, r, th, teeth in ((V((-0.045, -0.04, 1.262)), 0.032, 0.008, 18),
                                (V((0.05, -0.03, 1.27)), 0.024, 0.007, 14),
                                (V((0.01, 0.06, 1.265)), 0.028, 0.008, 16)):
            self.gear(mb, c, r, th, teeth, m['brass'])
        mb.box(m['black'], V((-0.02, 0.035, 1.27)), (0.05, 0.035, 0.03), bevel=0.002)
        self.obj_from('collar_mech', mb, 'chest')
        # neck cables (hooked chest -> neck -> head)
        specs = [(0.0045, 'black', 0.5), (0.0040, 'black', 2.4), (0.0036, 'black', 3.6),
                 (0.0026, 'copper', 1.75), (0.0021, 'red', 4.5), (0.0042, 'black', 5.4)]
        for i, (r, matk, ang) in enumerate(specs):
            dx, dy = math.cos(ang), math.sin(ang)
            yax = lambda z: 0.019 * max(0.0, min(1.0, (z - 1.31) / 0.112))
            pts = [(V((0.056 * dx, 0.036 * dy, 1.255)), 'chest'),
                   (V((0.05 * dx, 0.036 * dy + yax(1.315), 1.315)), 'chest'),
                   (V((0.05 * dx, 0.047 * dy + yax(1.362), 1.362)), 'neck'),
                   (top + V((0.044 * dx, 0.041 * dy, -0.036)), 'head'),
                   (top + V((0.021 * dx, 0.02 * dy, -0.013)), 'head')]
            self.hooked_cable(f'neck_cable_{i}', pts, r, m[matk])

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
        cu.materials.append(mat)
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

    # ================================================================= TORSO
    TORSO = {
        'T0': (-0.28, -0.10, 1.315), 'T1': (-0.11, -0.14, 1.32), 'T2': (0.11, -0.14, 1.32), 'T3': (0.28, -0.10, 1.315),
        'M0': (-0.29, -0.08, 1.18), 'M1': (-0.16, -0.165, 1.18), 'M2': (0.0, -0.175, 1.16), 'M3': (0.16, -0.165, 1.18),
        'M4': (0.29, -0.08, 1.18),
        'B0': (-0.24, -0.07, 1.05), 'B1': (-0.10, -0.155, 1.05), 'B2': (0.10, -0.155, 1.05), 'B3': (0.24, -0.07, 1.05),
        'D0': (-0.17, -0.06, 0.99), 'D1': (0.0, -0.12, 0.99), 'D2': (0.17, -0.06, 0.99),
        'T0b': (-0.28, 0.10, 1.315), 'T1b': (-0.11, 0.13, 1.32), 'T2b': (0.11, 0.13, 1.32), 'T3b': (0.28, 0.10, 1.315),
        'M0b': (-0.29, 0.08, 1.18), 'M1b': (-0.15, 0.14, 1.18), 'M2b': (0.0, 0.145, 1.17), 'M3b': (0.15, 0.14, 1.18),
        'M4b': (0.29, 0.08, 1.18),
        'B0b': (-0.24, 0.07, 1.05), 'B1b': (-0.10, 0.13, 1.05), 'B2b': (0.10, 0.13, 1.05), 'B3b': (0.24, 0.07, 1.05),
        'D0b': (-0.17, 0.06, 0.99), 'D1b': (0.0, 0.10, 0.99), 'D2b': (0.17, 0.06, 0.99),
        'C2': (0.075, 0.045, 1.322), 'C3': (-0.075, 0.045, 1.322),
    }

    def build_torso(self):
        T = {k: V(v) for k, v in self.TORSO.items()}
        self.torso_hull = Hull([v for k, v in T.items() if not k.startswith('C')])
        tc = V((0, 0, 1.16))
        plates = [
            # front (canonical layout)
            ('f_collar_r', ['T0', 'T1', 'M1', 'M0'], 'cream'),
            ('f_grey_r', ['M0', 'M1', 'B0'], 'grey'),
            ('f_mid_r', ['T1', 'M2', 'M1'], 'cream'),
            ('f_low_r', ['M1', 'B1', 'B0'], 'cream'),
            ('f_v', ['T1', 'T2', 'M2'], 'cream'),
            ('f_chip', ['T2', 'T3', 'M4', 'M3'], 'cream'),
            ('f_chip_in', ['T2', 'M3', 'M2'], 'cream'),
            ('f_grey_big', ['M2', 'M3', 'B3', 'B2'], 'grey'),
            ('f_outer_l', ['M3', 'M4', 'B3'], 'cream'),
            ('f_centre_r', ['M1', 'M2', 'B1'], 'cream'),
            ('f_centre_c', ['M2', 'B2', 'B1'], 'cream'),
            ('f_bot_r', ['B0', 'B1', 'D0'], 'cream'),
            ('f_bot_rc', ['B1', 'D1', 'D0'], 'cream'),
            ('f_bot_grey', ['B1', 'B2', 'D1'], 'grey'),
            ('f_bot_lc', ['B2', 'D2', 'D1'], 'cream'),
            ('f_bot_l', ['B2', 'B3', 'D2'], 'cream'),
            # sides (upper flank left open: armpit mechanics)
            ('s_mid_r', ['M0', 'B0', 'B0b', 'M0b'], 'cream'),
            ('s_low_r', ['B0', 'D0', 'D0b', 'B0b'], 'cream'),
            ('s_mid_l', ['M4', 'M4b', 'B3b', 'B3'], 'cream'),
            ('s_low_l', ['B3', 'B3b', 'D2b', 'D2'], 'cream'),
            # top yoke around the collar opening
            ('t_r', ['T0', 'T1', 'C3', 'T1b', 'T0b'], 'cream'),
            ('t_l', ['T3b', 'T2b', 'C2', 'T2', 'T3'], 'cream'),
            ('t_back', ['C3', 'C2', 'T2b', 'T1b'], 'grey'),
            # back
            ('b_top_r', ['T0b', 'T1b', 'M1b', 'M0b'], 'cream'),
            ('b_top_c', ['T1b', 'T2b', 'M2b'], 'cream'),
            ('b_top_cr', ['T1b', 'M2b', 'M1b'], 'grey'),
            ('b_top_cl', ['T2b', 'M3b', 'M2b'], 'cream'),
            ('b_top_l', ['T2b', 'T3b', 'M4b', 'M3b'], 'cream'),
            ('b_mid_r', ['M0b', 'M1b', 'B1b', 'B0b'], 'cream'),
            ('b_mid_c', ['M1b', 'M2b', 'B1b'], 'cream'),
            ('b_mid_c2', ['M2b', 'B2b', 'B1b'], 'cream'),
            ('b_mid_cl', ['M2b', 'M3b', 'B2b'], 'grey'),
            ('b_mid_l', ['M3b', 'M4b', 'B3b', 'B2b'], 'cream'),
            ('b_bot_r', ['B0b', 'B1b', 'D1b', 'D0b'], 'cream'),
            ('b_bot_l', ['B1b', 'B2b', 'D2b', 'D1b'], 'grey'),
            ('b_bot_l2', ['B2b', 'B3b', 'D2b'], 'cream'),
        ]
        for key, names, kind in plates:
            poly = [T[n] for n in names]
            c = sum(poly, V()) / len(poly)
            out = c - tc
            if key.startswith('t_'):
                out = UP
            self.plate('torso_' + key, poly, out, kind, 'chest', self.torso_plates, reg='torso')
        # inner core: everything below the collar cavity floor, dark
        core = [T[k] - (T[k] - tc).normalized() * 0.006 for k in T if not k.startswith('C')]
        core = [V((p.x, p.y, min(p.z, 1.245))) for p in core]
        mb = MB()
        mb.hull(self.mat['core'], core)
        # upper flank mechanics visible through the open armpits
        for sx in (-1, 1):
            mb.box(self.mat['gun'], V((0.235 * sx, 0.0, 1.255)), (0.06, 0.12, 0.06), bevel=0.004)
            mb.cylinder(self.mat['chrome'], V((0.25 * sx, -0.06, 1.20)), V((0.25 * sx, 0.06, 1.20)), 0.008)
            for k, z in enumerate((1.21, 1.235)):
                mb.cylinder(self.mat['rubber'], V((0.21 * sx, -0.05 + 0.03 * k, z)), V((0.28 * sx, -0.04 + 0.03 * k, z)),
                            0.005)
        self.obj_from('torso_core', mb, 'chest')
        # blue paint chip on the chest plate (character's left, beside the strap)
        self.blue_chip(T)

    def blue_chip(self, T, centre=(0.104, 0.0, 1.236)):
        """Flaked cobalt paint patch on whichever front plate holds `centre` (x, -, z)."""
        best = None
        for ob in self.torso_plates:
            if not ob.name.split('torso_')[-1].startswith('f_'):
                continue
            n = V(ob['plate_normal'])
            flat = list(ob['plate_poly'])
            poly = [V(flat[i:i + 3]) for i in range(0, len(flat), 3)]
            p0 = poly[0]
            if abs(n.y) < 0.3:
                continue
            cen = V(centre)
            cen.y = p0.y - ((cen.x - p0.x) * n.x + (cen.z - p0.z) * n.z) / n.y
            inside = True
            k = len(poly)
            for i in range(k):
                a_, b_ = poly[i], poly[(i + 1) % k]
                if (cen - a_).dot(n.cross(b_ - a_)) < 0:
                    inside = False
                    break
            if inside:
                best = (ob, n, cen, poly)
                break
        if best is None:
            return
        plate, n, cen, poly = best
        ax = V((1, 0, 0))
        ax = (ax - n * ax.dot(n)).normalized()
        ay = n.cross(ax).normalized()
        if ay.z < 0:
            ay = -ay
        import random
        rnd = random.Random(7)
        pts = []
        K = 56
        for i in range(K):
            a = 2 * math.pi * i / K
            r = 1.0 + 0.22 * math.sin(3 * a + 0.4) + 0.12 * math.sin(7 * a + 1.3) + rnd.uniform(-0.13, 0.13)
            x = 0.031 * r * math.cos(a)
            y = 0.0175 * r * math.sin(a) * (1.3 if math.sin(a) < 0 else 1.0)
            q = cen + ax * x + ay * y + n * 0.0003
            # keep inside the plate
            for j in range(len(poly)):
                a_, b_ = poly[j], poly[(j + 1) % len(poly)]
                mm = n.cross(b_ - a_).normalized()
                d = (q - a_).dot(mm)
                if d < 0.007:
                    q = q + mm * (0.007 - d)
            pts.append(q)
        mb = MB()
        mb.prism(self.mat['chip'], pts, n, 0.0002)
        ob = mb.to_object(f'{self.name}_blue_chip', self.coll, origin=cen)
        ob.parent = plate
        ob.matrix_parent_inverse = Matrix.Translation(plate.location).inverted()
        self.parts['blue_chip'] = ob

    # ================================================================= WAIST / PELVIS
    PELVIS = {
        'PT0': (-0.17, -0.09, 0.90), 'PT1': (-0.06, -0.112, 0.90), 'PT2': (0.06, -0.112, 0.90), 'PT3': (0.17, -0.09, 0.90),
        'PB0': (-0.085, -0.075, 0.795), 'PB1': (0.0, -0.095, 0.78), 'PB2': (0.085, -0.075, 0.795),
        'PT0b': (-0.17, 0.09, 0.90), 'PT1b': (-0.06, 0.10, 0.90), 'PT2b': (0.06, 0.10, 0.90), 'PT3b': (0.17, 0.09, 0.90),
        'PB0b': (-0.085, 0.075, 0.795), 'PB1b': (0.0, 0.085, 0.785), 'PB2b': (0.085, 0.075, 0.795),
    }

    def build_pelvis(self):
        T = {k: V(v) for k, v in self.PELVIS.items()}
        pc = V((0, 0, 0.85))
        plates = [
            ('f_r', ['PT0', 'PT1', 'PB1', 'PB0'], 'cream'), ('f_c', ['PT1', 'PT2', 'PB1'], 'grey'),
            ('f_l', ['PT2', 'PT3', 'PB2', 'PB1'], 'cream'),
            ('s_r', ['PT0', 'PB0', 'PB0b', 'PT0b'], 'cream'), ('s_l', ['PT3', 'PT3b', 'PB2b', 'PB2'], 'cream'),
            ('b_r', ['PT0b', 'PB0b', 'PB1b', 'PT1b'], 'cream'), ('b_c', ['PT1b', 'PB1b', 'PT2b'], 'grey'),
            ('b_l', ['PT2b', 'PB1b', 'PB2b', 'PT3b'], 'cream'),
            ('u', ['PB0', 'PB1', 'PB2', 'PB2b', 'PB1b', 'PB0b'], 'dark'),
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
        # ---- pauldron (pauldron bone)
        cx = 0.35 * sx
        pts = []
        for y in (-0.095, 0.095):
            pts += [V((cx + 0.095 * sx, y, 1.222)), V((cx - 0.075 * sx, y * 0.95, 1.343))]
        for y in (-0.064, 0.064):
            pts += [V((cx - 0.042 * sx, y, 1.378)), V((cx + 0.058 * sx, y, 1.342))]
        pts += [V((cx + 0.012 * sx, -0.104, 1.28)), V((cx + 0.012 * sx, 0.104, 1.28)),
                V((cx + 0.104 * sx, 0, 1.268))]
        hull = Hull(pts)
        bm = bmesh.new()
        for p in pts:
            bm.verts.new(p)
        bmesh.ops.convex_hull(bm, input=bm.verts)
        bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(2), verts=bm.verts, edges=bm.edges)
        bm.normal_update()
        pc = sum(pts, V()) / len(pts)
        polys = []
        for fc in bm.faces:
            poly = [vv.co.copy() for vv in fc.verts]
            nn = fc.normal.copy()
            if nn.dot(fc.calc_center_median() - pc) < 0:
                nn = -nn
            polys.append((poly, nn))
        bm.free()
        mb = MB()
        mi_core = mb.mi(m['core'])
        for poly, nn in polys:
            cen = sum(poly, V()) / len(poly)
            # open underside (faces pointing down/in toward the arm)
            if nn.z < -0.55:
                continue
            kind = 'grey' if (nn.z < -0.1 and nn.x * sx > 0.4) else 'cream'
            if nn.dot(V((0, -1, 0))) > 0.8 and nn.z > 0:
                kind = 'cream'
            mat = m['grey'] if kind == 'grey' else m['cream']
            rec = 0.0012 if kind == 'grey' else 0.0
            ppts = inset_poly(poly, nn, 0.00065)
            ppts = [p - nn * rec for p in ppts]
            if newell(ppts).dot(nn) < 0:
                ppts.reverse()
            faces = mb.prism(mat, ppts, nn, 0.0025, bevel=0.0008)
            for fc in faces:
                if fc.normal.dot(nn) < -0.95:
                    fc.material_index = mi_core
            rp, rs = self.rivet_points(ppts, nn, 'pauldron_' + s, 0.95, 0.04)
            mb.rivets(m['rivet'], rp, nn, rs)
        # mount bracket to the chest top
        mb.box(m['gun'], V((0.298 * sx, 0, 1.337)), (0.046, 0.066, 0.016), bevel=0.003)
        self.obj_from(f'pauldron_{s}', mb, f'pauldron_{s}')
        # ---- shoulder hub (shoulder bone)
        mb = MB()
        mb.cylinder(m['gun'], S - out * 0.03, S + out * 0.025, 0.031, seg=28)
        mb.cylinder(m['chrome'], S + out * 0.025, S + out * 0.031, 0.013, seg=16)
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
        # cable bundle on the inner side
        for k, (mk, r) in enumerate((('black', 0.0042), ('red', 0.0028), ('copper', 0.0025))):
            off = -f * (0.045 + 0.0055 * k) - out * (0.006 * (k - 1))
            path = [S + d * t + off + (-out) * 0.006 * math.sin(math.pi * t / UPPER_LEN) for t in
                    [UPPER_LEN * i / 10 for i in range(11)]]
            mb.sweep(m['black'] if mk == 'black' else m[mk], path, circle_profile(r, 8))
        # small cream plate on the outer upper arm
        pc = S + d * 0.085 + out * 0.024
        a1 = d * 0.045
        a2 = f * 0.035
        poly = [pc - a1 - a2, pc - a1 + a2, pc + a1 + a2 * 0.8, pc + a1 - a2 * 0.8]
        if newell(poly).dot(out) < 0:
            poly.reverse()
        mb.prism(m['cream'], poly, out, 0.0025, bevel=0.0008)
        rp, rs = self.rivet_points(poly, out, 'uarm_' + s, 0.85, 0.04)
        mb.rivets(m['rivet'], rp, out, rs)
        # bracket for the outer elbow piston
        mb.box(m['gun'], S + d * 0.142 + hz * 0.04, (0.014, 0.03, 0.03), rot=frame3(d, hz), bevel=0.002)
        # elbow hub (rides on the upper arm)
        mb.cylinder(m['gun'], E - hinge * 0.026, E + hinge * 0.026, 0.0325, seg=28)
        for k in (-1, 1):
            mb.cylinder(m['chrome'], E + hinge * 0.026 * k, E + hinge * 0.031 * k, 0.012, seg=16)
        self.obj_from(f'upperarm_{s}', mb, f'upperarm_{s}')
        # bicep piston (upper arm -> forearm)
        hz = hinge if hinge.dot(out) > 0 else -hinge
        self.piston3(f'bicep_{s}', S + d * 0.15 + hz * 0.056, f'upperarm_{s}', E + d * 0.09 + hz * 0.056,
                     f'forearm_{s}', 0.0085, 0.0045, stage=0.37)
        # ---- forearm shell (forearm bone)
        mb = MB()
        mi_core = mb.mi(m['core'])
        a0 = E + d * 0.05
        a1_ = W - d * 0.027
        sides = 8
        ringA, ringB = [], []
        # side 0 faces 'out', side 2 faces 'f' (top in the cup pose), side 4 faces in (open)
        for i in range(sides):
            ang = 2 * math.pi * (i + 0.5) / sides
            dirv = out * math.cos(ang) + f * math.sin(ang)
            ringA.append(a0 + dirv * 0.040 / math.cos(math.pi / sides))
            ringB.append(a1_ + dirv * 0.034 / math.cos(math.pi / sides))
        for i in range(sides):
            j = (i + 1) % sides
            ang = 2 * math.pi * i / sides
            nn = (out * math.cos(ang) + f * math.sin(ang)).normalized()
            if i == 4:
                continue  # inner side open
            kind = 'grey' if i == 2 else 'cream'
            poly = [ringA[i], ringA[j], ringB[j], ringB[i]]
            if newell(poly).dot(nn) < 0:
                poly.reverse()
            ppts = inset_poly(poly, newell(poly), 0.0006)
            if kind == 'grey':
                ppts = [p - nn * 0.001 for p in ppts]
            faces = mb.prism(m['grey'] if kind == 'grey' else m['cream'], ppts, newell(ppts), 0.0025, bevel=0.0008)
            for fc in faces:
                if fc.normal.dot(nn) < -0.9:
                    fc.material_index = mi_core
            rp, rs = self.rivet_points(ppts, newell(ppts), 'farm_' + s, 0.8, 0.06)
            mb.rivets(m['rivet'], rp, newell(ppts), rs)
            if i == 0:
                vc = (ringA[i] + ringA[j] + ringB[i] + ringB[j]) / 4 + nn * 0.0012 - d * 0.02
                mb.box(m['black'], vc, (0.06, 0.012, 0.003), rot=frame3(d, ringA[j] - ringA[i]), bevel=0.001)
        # inner rods and core
        mb.cylinder(m['core'], a0, a1_, 0.022, seg=12)
        for k in (-1, 1):
            mb.cylinder(m['chrome'], a0 - out * 0.018 + f * 0.012 * k, a1_ - out * 0.015 + f * 0.01 * k, 0.0045, seg=10)
        # wrist band
        bandA, bandB = W - d * 0.041, W - d * 0.026
        mb.cylinder(m['rubber'], bandA, bandB, 0.0368, 0.0358, seg=8)
        mb.cylinder(m['gun'], W - d * 0.027, W - d * 0.014, 0.0155, seg=12)
        mb.box(m['gun'], E + d * 0.097 + hz * 0.042, (0.012, 0.026, 0.024), rot=frame3(d, hz), bevel=0.002)
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
        # back-of-hand cream plate(s)
        bc = W + u * 0.063 - w * 0.0155
        poly = [bc - u * 0.030 - v * 0.032, bc + u * 0.031 - v * 0.040, bc + u * 0.033 + v * 0.040,
                bc - u * 0.026 + v * 0.030]
        nn = -w
        if newell(poly).dot(nn) < 0:
            poly.reverse()
        mb.prism(m['cream'], poly, nn, 0.003, bevel=0.0009)
        rp, rs = self.rivet_points(poly, newell(poly), 'hand_' + s, 0.75, 0.035)
        mb.rivets(m['rivet'], rp, newell(poly), rs)
        # knuckle hubs
        for name, fd in fingers.items():
            K = fd['K']
            mb.cylinder(m['rubber'], K - v * 0.0075, K + v * 0.0075, 0.0094, seg=16)
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
                r0 = FINGER_R - 0.0004 * i
                r1 = r0 - 0.0004
                start = a + dirn * (0.0095 if i == 0 else 0.0036)
                end = b - dirn * 0.0036 if i < 2 else b
                self.finger_segment(mb, start, end, r0, r1, w, last=(i == 2))
                if i > 0:
                    # joint band centred on the joint at the start of this segment
                    mb.cylinder(m['rubber'], a - dirn * 0.0031, a + dirn * 0.0031, r0 + 0.0011, seg=14)
                self.obj_from(f'{name}_{i + 1}_{s}', mb, f'{name}_{i + 1}_{s}')
        # thumb: metacarpal (dark) + two cream segments
        T0, T1, T2, T3 = thumb['pts']
        mb = MB()
        mb.cylinder(m['gun'], T0, T1 - thumb['d0'] * 0.002, 0.0095, 0.0085, seg=12)
        self.obj_from(f'thumb_0_{s}', mb, f'thumb_0_{s}')
        mb = MB()
        d1 = thumb['d1']
        mb.cylinder(m['rubber'], T1 - d1 * 0.004, T1 + d1 * 0.004, 0.0098, seg=14)
        self.finger_segment(mb, T1 + d1 * 0.004, T2 - d1 * 0.0036, 0.0088, 0.0084, w, last=False)
        self.obj_from(f'thumb_1_{s}', mb, f'thumb_1_{s}')
        mb = MB()
        mb.cylinder(m['rubber'], T2 - d1 * 0.0034, T2 + d1 * 0.0034, 0.0096, seg=14)
        self.finger_segment(mb, T2 + d1 * 0.0036, T3, 0.0083, 0.0078, w, last=True)
        self.obj_from(f'thumb_2_{s}', mb, f'thumb_2_{s}')

    def finger_segment(self, mb, a, b, r0, r1, w, last=False):
        """Cream, slightly flattened segment with chamfered ends; bronze rounded tip cap if last."""
        m = self.mat
        d = (b - a)
        L = d.length
        d.normalize()
        flat = 0.86
        seg = 12
        x = (w - d * d.dot(w)).normalized()   # flattened toward the palm normal
        y = d.cross(x)

        def ring(c, r):
            return [c + (x * math.cos(2 * math.pi * k / seg) * r * flat + y * math.sin(2 * math.pi * k / seg) * r)
                    for k in range(seg)]

        tipL = 0.0085 if last else 0.0
        bodyL = L - tipL
        rings = [(0.0, r0 * 0.62), (0.0028, r0), (bodyL - 0.0028 if not last else bodyL, r1),
                 (bodyL, r1 * 0.62 if not last else r1)]
        before = set(mb.bm.faces)
        vr = []
        for t, r in rings:
            vr.append([mb.bm.verts.new(p) for p in ring(a + d * t, r)])
        for k in range(len(vr) - 1):
            for i in range(seg):
                j = (i + 1) % seg
                mb.bm.faces.new((vr[k][i], vr[k][j], vr[k + 1][j], vr[k + 1][i]))
        mb.bm.faces.new(list(reversed(vr[0])))
        if not last:
            mb.bm.faces.new(vr[-1])
        mb._tag(before, m['cream'], True)
        if last:
            before = set(mb.bm.faces)
            prof = [(r1, 0.0), (r1 * 0.98, 0.0035), (r1 * 0.88, 0.0062), (r1 * 0.62, 0.0080), (r1 * 0.3, 0.0088),
                    (0.0, 0.0090)]
            ringsT = []
            for rr, t in prof:
                if rr < 1e-6:
                    ringsT.append([mb.bm.verts.new(a + d * (bodyL + t))])
                else:
                    ringsT.append([mb.bm.verts.new(p) for p in ring(a + d * (bodyL + t), rr)])
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
        self.hex_shell(mb, sx, V((X + 0.006 * sx, 0, 0.742)), V((X, 0, 0.532)), (0.185, 0.165), (0.13, 0.125),
                       'thigh_' + s, grey_sides=(1, 4), top_drop=(0.042, 0.024, 0.0, 0.0, 0.0, 0.024))
        mb.cylinder(m['gun'], V((X, 0, 0.535)), V((X, 0, 0.505)), 0.04, 0.036, seg=16)
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
        self.hex_shell(mb, sx, V((X, 0, 0.428)), V((X, 0, 0.14)), (0.13, 0.125), (0.09, 0.09), 'shin_' + s,
                       grey_sides=(2, 5))
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

    def hex_shell(self, mb, sx, top, bot, size_top, size_bot, reg, grey_sides=(), top_drop=None):
        m = self.mat
        mi_core = mb.mi(m['core'])

        def ring(c, size):
            W_, D_ = size
            return [c + V((0, -D_ / 2, 0)), c + V((W_ / 2 * sx, -D_ / 4, 0)), c + V((W_ / 2 * sx, D_ / 4, 0)),
                    c + V((0, D_ / 2, 0)), c + V((-W_ / 2 * sx, D_ / 4, 0)), c + V((-W_ / 2 * sx, -D_ / 4, 0))]

        rt, rb = ring(top, size_top), ring(bot, size_bot)
        if top_drop:
            rt = [p - V((0, 0, dz)) for p, dz in zip(rt, top_drop)]
        cen = (top + bot) / 2
        for i in range(6):
            j = (i + 1) % 6
            mid_t = (rt[i] + rt[j]) / 2
            mid_b = (rb[i] + rb[j]) / 2
            tris = [[rt[i], rt[j], rb[i]], [rt[j], rb[j], rb[i]]] if i % 2 == 0 else \
                [[rt[i], rt[j], rb[j]], [rt[i], rb[j], rb[i]]]
            for k, poly in enumerate(tris):
                c = sum(poly, V()) / 3
                nn = newell(poly)
                if nn.dot(c - V((cen.x, cen.y, c.z))) < 0:
                    poly = list(reversed(poly))
                    nn = -nn
                kind = 'grey' if (i in grey_sides and k == 0) else 'cream'
                ppts = inset_poly(poly, nn, 0.00065)
                if kind == 'grey':
                    ppts = [p - nn * 0.0012 for p in ppts]
                faces = mb.prism(m['grey'] if kind == 'grey' else m['cream'], ppts, nn, 0.0025, bevel=0.0008)
                for fc in faces:
                    if fc.normal.dot(nn) < -0.9:
                        fc.material_index = mi_core
                rp, rs = self.rivet_points(ppts, nn, reg, 0.85, 0.045)
                mb.rivets(m['rivet'], rp, nn, rs)
        core = [p + (V((cen.x, cen.y, p.z)) - p).normalized() * 0.005 for p in rt + rb]
        mb.hull(m['core'], core)
        # machined end caps with a centre boss so the open ends never read as hollow tubes
        for ring_, sgn in ((rt, -1.0), (rb, 1.0)):
            cc = sum(ring_, V()) / len(ring_)
            cap = [cc + (q - cc) * 0.9 + V((0, 0, 0.004 * sgn)) for q in ring_]
            nrm = V((0, 0, -sgn))
            if newell(cap).dot(nrm) < 0:
                cap.reverse()
            mb.prism(m['gun'], cap, nrm, 0.004, bevel=0.0012)
            mb.cylinder(m['gun'], cc + V((0, 0, 0.002 * sgn)), cc - nrm * 0.012 + V((0, 0, 0.002 * sgn)),
                        0.022, seg=20)
            for k in range(6):
                ang = math.pi / 3 * k + math.pi / 6
                bp = cc + V((math.cos(ang), math.sin(ang), 0)) * 0.034 - nrm * 0.0005 + V((0, 0, 0.004 * sgn))
                mb.cylinder(m['rivet'], bp, bp - nrm * 0.003, 0.0035, seg=8)

    def hull_plates(self, mb, pts, reg, grey_pick=lambda n: False, skip_down=False):
        m = self.mat
        mi_core = mb.mi(m['core'])
        bm = bmesh.new()
        for p in pts:
            bm.verts.new(p)
        bmesh.ops.convex_hull(bm, input=bm.verts)
        bmesh.ops.dissolve_limit(bm, angle_limit=math.radians(2), verts=bm.verts, edges=bm.edges)
        bm.normal_update()
        pc = sum(pts, V()) / len(pts)
        polys = []
        for fc in bm.faces:
            nn = fc.normal.copy()
            if nn.dot(fc.calc_center_median() - pc) < 0:
                nn = -nn
            polys.append(([v_.co.copy() for v_ in fc.verts], nn))
        bm.free()
        for poly, nn in polys:
            if skip_down and nn.z < -0.9:
                continue
            kind = 'grey' if grey_pick(nn) else 'cream'
            if newell(poly).dot(nn) < 0:
                poly.reverse()
            ppts = inset_poly(poly, nn, 0.00065)
            if kind == 'grey':
                ppts = [p - nn * 0.001 for p in ppts]
            faces = mb.prism(m['grey'] if kind == 'grey' else m['cream'], ppts, nn, 0.0025, bevel=0.0008)
            for fc in faces:
                if fc.normal.dot(nn) < -0.9:
                    fc.material_index = mi_core
            rp, rs = self.rivet_points(ppts, nn, reg, 0.8, 0.04)
            mb.rivets(m['rivet'], rp, nn, rs)
        mb.hull(m['core'], [p + (pc - p).normalized() * 0.004 for p in pts])

    # ================================================================= CUP
    def build_cup(self):
        m = self.mat
        mb = MB()
        o = V((0, 0, 0))
        prof = [(0.0, 0.004), (0.0285, 0.004), (0.0292, 0.0), (CUP_R0, 0.0)]
        for i in range(1, 13):
            h = CUP_H * i / 12
            prof.append((cup_radius(h), h))
        mb.lathe(m['cup'], prof, o, UP, seg=56, close_bottom=False, close_top=False)
        # inner wall just below the rim (visible only if the lid comes off)
        mb.lathe(m['cup'], [(CUP_R1 - 0.0006, CUP_H), (cup_radius(CUP_H - 0.03) - 0.0006, CUP_H - 0.03),
                            (0.0, CUP_H - 0.03)], o, UP, seg=56, close_bottom=False, close_top=False)
        mb.torus(m['cup'], V((0, 0, CUP_H)), UP, CUP_R1 - 0.0004, 0.0021, seg=56, seg2=10)
        # lid
        lid = [(CUP_R1 + 0.0008, CUP_H - 0.007), (CUP_R1 + 0.0021, CUP_H - 0.006), (CUP_R1 + 0.0026, CUP_H + 0.002),
               (CUP_R1 + 0.0022, CUP_H + 0.0085), (CUP_R1 + 0.0010, CUP_H + 0.0118), (CUP_R1 - 0.0025, CUP_H + 0.0126),
               (CUP_R1 - 0.0045, CUP_H + 0.0112), (CUP_R1 - 0.0055, CUP_H + 0.0082), (CUP_R1 - 0.0075, CUP_H + 0.0078),
               (0.0, CUP_H + 0.0078)]
        mb.lathe(m['lid'], lid, o, UP, seg=64, close_bottom=False, close_top=False)
        mb.lathe(m['lid'], [(CUP_R1 + 0.0008, CUP_H - 0.007), (CUP_R1 - 0.0005, CUP_H - 0.0068)], o, UP, seg=64,
                 close_bottom=False, close_top=False)
        # sip spout: raised lozenge near the rim (toward -Y in cup space)
        sc = V((0, -0.030, CUP_H + 0.0105))
        mb.sphere(m['lid'], sc, 0.008, seg=20, rings=10, scale=(1.5, 0.9, 0.42))
        mb.box(self.mat['core'], sc + V((0, -0.0035, 0.0028)), (0.008, 0.002, 0.0012))
        ob = mb.to_object('cup', self.coll)
        ob.name = f'{self.name}_cup'
        self.parts['cup'] = ob
        return ob

    # ================================================================= LANYARD + BADGE
    def build_lanyard(self):
        m = self.mat
        hull = self.torso_hull
        Vp = V((0.0, -0.188, 1.103))
        self.badge_pivot = Vp
        path = []
        for sx in (-1, 1):
            side = [V((0.0, 0.066, 1.335)), V((0.058 * sx, 0.052, 1.335)), V((0.082 * sx, -0.005, 1.333)),
                    V((0.098 * sx, -0.09, 1.331)), V((0.103 * sx, -0.137, 1.329))]
            down = [V((0.103 * sx, -0.146, 1.318)).lerp(Vp + V((0.007 * sx, 0, 0.004)), t)
                    for t in [i / 10 for i in range(1, 11)]]
            down = [hull.push(p, 0.0022) for p in down]
            seq = side + down
            if sx < 0:
                path += list(reversed(seq))
            else:
                path += seq[1:]
        pts = spline_pts(path, 3)
        # normals: torso surface normal (outward), up over the collar
        nrm = []
        for p in pts:
            if p.z > 1.322:
                nrm.append(UP.copy())
            else:
                best = max(hull.planes, key=lambda nd: nd[0].dot(p) - nd[1])
                nrm.append(best[0])
        # the strap lies flat: profile x across the width, y along the surface normal
        prof = [(-0.010, -0.00075), (0.010, -0.00075), (0.010, 0.00075), (-0.010, 0.00075)]
        mb = MB()
        mb.sweep(m['strap'], pts, prof, normals=nrm, uv=True)
        self.obj_from('lanyard', mb, 'chest')
        # crimp, swivel hook, clear clip, badge (badge bone)
        mb = MB()
        mb.box(m['black'], Vp + V((0, 0, -0.002)), (0.016, 0.006, 0.016), bevel=0.0015)
        hook_c = Vp + V((0, -0.002, -0.022))
        mb.cylinder(m['clip'], Vp + V((0, 0, -0.010)), Vp + V((0, 0, -0.014)), 0.0035, seg=12)
        mb.torus(m['clip'], hook_c, V((0, 1, 0)), 0.0075, 0.0016, seg=24, seg2=8, arc=(math.radians(-60), math.radians(250)))
        mb.cylinder(m['clip'], hook_c + V((0.0075 * math.cos(math.radians(-60)), 0, 0.0075 * math.sin(math.radians(-60)))),
                    hook_c + V((0.0, 0, -0.0075)), 0.0012, seg=8)
        clip_top = hook_c + V((0, 0, -0.008))
        mb.box(m['vinyl'], clip_top + V((0, 0, -0.012)), (0.012, 0.0025, 0.026), bevel=0.0008)
        mb.box(m['clip'], clip_top + V((0, 0, -0.002)), (0.009, 0.004, 0.004), bevel=0.0008)
        badge_top = clip_top.z - 0.020
        bc = V((0.0, Vp.y + 0.006, badge_top - 0.040))
        # clear sleeve 0.105 x 0.080, card 0.100 x 0.072 inside
        mb.box(m['vinyl'], bc, (0.105, 0.0024, 0.080), bevel=0.0009)
        self.obj_from('badge_hw', mb, 'badge')
        mb = MB()
        bm = mb.bm
        uvl = bm.loops.layers.uv.new('UVMap')
        w_, h_ = 0.100, 0.072
        y0 = bc.y
        vs = [bm.verts.new(V((x, y0, z))) for x, z in
              ((-w_ / 2, bc.z - h_ / 2 - 0.003), (w_ / 2, bc.z - h_ / 2 - 0.003), (w_ / 2, bc.z + h_ / 2 - 0.003),
               (-w_ / 2, bc.z + h_ / 2 - 0.003))]
        f = bm.faces.new(vs)
        f.normal_update()
        if f.normal.y > 0:
            f.normal_flip()
        for loop in f.loops:
            co = loop.vert.co
            loop[uvl].uv = ((co.x + w_ / 2) / w_, (co.z - (bc.z - 0.003) + h_ / 2) / h_)
        back = bm.faces.new([bm.verts.new(V((x, y0 + 0.0004, z))) for x, z in
                             ((-w_ / 2, bc.z - h_ / 2 - 0.003), (-w_ / 2, bc.z + h_ / 2 - 0.003),
                              (w_ / 2, bc.z + h_ / 2 - 0.003), (w_ / 2, bc.z - h_ / 2 - 0.003))])
        mb.mi(m['card'])
        card = self.obj_from('badge', mb, 'badge', origin=bc)
        self.badge = card

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
            bone(f'pauldron_{s}', S, S + d * 0.1, f'shoulder_{s}', roll_to=FWD)
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
            lim.min_z, lim.max_z = math.radians(-15), math.radians(15)
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

    def _finger_keys(self, frame, s, val, interp):
        hd = self.hands[s]
        w = hd['w']
        if isinstance(val, str):
            angles = self.grip_angles(s)['fingers']
        else:
            angles = {n: [a * float(val) for a in FIST] for n in FINGERS}
        for name, fd in hd['fingers'].items():
            for i in range(3):
                bn = f'{name}_{i + 1}_{s}'
                d = self._dir(bn)
                self.key_rest_rot(bn, frame, rot_to(d, w, angles[name][i]), interp)

    def _thumb_keys(self, frame, s, val, interp):
        if isinstance(val, str) and val == 'grip':
            g = self.grip_angles(s)['thumb']
            for i, R in enumerate(g):
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
        c = float(val)
        palm_c = hd['W'] + u * 0.06
        for i, deg in ((0, 22.0), (1, 38.0), (2, 45.0)):
            a, b = tp[i], tp[i + 1]
            d = (b - a).normalized()
            toward = (palm_c - b)
            toward = (toward - d * toward.dot(d)).normalized()
            self.key_rest_rot(f'thumb_{i}_{s}', frame, rot_to(d, toward, deg * c), interp)

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

    def place_arm(self, frame, s, wrist, hand_u, hand_w, pole, interp='BEZIER'):
        Ru, Rf, Rh = self.solve_arm(s, wrist, hand_u, hand_w, pole)
        self.key_rest_rot(f'upperarm_{s}', frame, Ru, interp)
        self.key_rest_rot(f'forearm_{s}', frame, Rf, interp)
        self.key_rest_rot(f'hand_{s}', frame, Rh, interp)
        self.key_rest_rot(f'shoulder_{s}', frame, Matrix.Identity(3), interp)

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
            if h > CUP_H + 0.012 or h < -0.002:
                return 1.0
            rr = cup_radius(h) + (0.0028 if h > CUP_H - 0.008 else 0.0)
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
    def apply_preset(self, frame, name, interp='BEZIER'):
        p = self.pose
        if name == 'neutral':
            self.rest(frame, interp)
            return
        if name in ('idle_cup', 'idle_cup_high', 'thumbs_up', 'sip', 'hands_clasped', 'reach_L', 'seated'):
            # body defaults
            p(frame, interp, pelvis=(0, 0, 0), spine=(0, 0, 0), chest=(0, 0, 0), neck=(2, 0, 0), head=(0, 5, 0))
            p(frame, interp, thigh_L=(0, 0, 0), thigh_R=(0, 0, 0), shin_L=0, shin_R=0, foot_L=0, foot_R=0)
        if name == 'idle_cup':
            self.hold_cup(frame, 'R', **IDLE_CUP, interp=interp)
            self.relaxed_arm(frame, 'L', interp)
        elif name == 'idle_cup_high':
            self.hold_cup(frame, 'R', **IDLE_CUP_HIGH, interp=interp)
            self.relaxed_arm(frame, 'L', interp)
        elif name == 'thumbs_up':
            self.hold_cup(frame, 'R', **IDLE_CUP, interp=interp)
            wrist = V((0.36, -0.30, 1.09))
            self.place_arm(frame, 'L', wrist, hand_u=V((-0.42, -0.90, 0.1)), hand_w=V((-0.90, 0.42, 0.0)),
                           pole=V((0.45, 0.35, -0.8)), interp=interp)
            p(frame, interp, fingers_L=1.0, thumb_L='up', head=(0, 7, 4))
        elif name == 'sip':
            self.hold_cup(frame, 'R', cup_base=V((-0.08, -0.34, 1.30)), cup_axis=V((0.2, 0.3, 1.0)),
                          finger_dir=V((0.55, -0.83, 0.0)), pole=V((-0.75, 0.15, -0.65)), interp=interp)
            self.relaxed_arm(frame, 'L', interp)
            p(frame, interp, head=(-6, 3, -6), neck=(-4, 0, 0))
        elif name == 'hands_clasped':
            # executive steeple: hands raised in front of the chest, palms facing, fingertips pointing
            # at each other a few cm apart.
            # Needs both hands free: park the cup first (rig.attach_cup(frame, None) and key it on a desk).
            # With canon proportions (0.52 m arm, shoulders at +-0.31 m) the wrists cannot meet at the
            # centre line without the arms crossing the chest, but the fingertips can.
            for s_, sx in (('R', -1.0), ('L', 1.0)):
                u = V((-0.45 * sx, -0.45, 0.72)).normalized()
                w = V((-sx, 0.0, 0.0))
                w = (w - u * w.dot(u)).normalized()
                self.place_arm(frame, s_, V((0.14 * sx, -0.34, 1.12)), hand_u=u, hand_w=w,
                               pole=V((1.0 * sx, 0.0, -0.4)), interp=interp)
            p(frame, interp, fingers_L=0.12, fingers_R=0.12, thumb_L=0.35, thumb_R=0.35, head=(4, 5, 0))
        elif name == 'reach_L':
            self.hold_cup(frame, 'R', **IDLE_CUP, interp=interp)
            self.place_arm(frame, 'L', V((0.30, -0.36, 0.93)), hand_u=V((0.0, -0.8, -0.6)),
                           hand_w=V((0.0, 0.6, -0.8)), pole=V((0.6, 0.35, -0.7)), interp=interp)
            p(frame, interp, fingers_L=0.15, thumb_L=0.1, chest=(6, 0, 4), head=(6, 3, 6))
        elif name == 'seated':
            drop = -(HIP_Z - KNEE_Z)
            p(frame, interp, thigh_L=(88, 3, 0), thigh_R=(88, 3, 0), shin_L=88, shin_R=88, foot_L=0, foot_R=0)
            self.key_loc('root', frame, V((0, 0, drop)), interp, index=1)
            self.hold_cup(frame, 'R', **IDLE_CUP, interp=interp)
            self.place_arm(frame, 'L', V((0.15, -0.14, 0.955)), hand_u=V((0.0, -1.0, 0.0)),
                           hand_w=V((0.2, 0, -1)), pole=V((0.9, 0.4, -0.2)), interp=interp)
            p(frame, interp, fingers_L=0.06, thumb_L='up')
        else:
            raise KeyError(f'unknown preset {name!r}')

    def hold_cup(self, frame, s, cup_base, finger_dir, pole, cup_axis=UP, interp='BEZIER',
                 chest_rest_offset=V((0, 0, 0))):
        """Pose arm s so its hand holds the cup with its base centre at cup_base
        (chest-rest space) and its axis along cup_axis; fingers wrap the cup."""
        wrist, u, w = self.cup_hand_frame(s, V(cup_base) - chest_rest_offset, cup_axis, finger_dir)
        self.place_arm(frame, s, wrist, u, w, pole, interp)
        self.pose(frame, interp, **{f'fingers_{s}': 'grip', f'thumb_{s}': 'grip'})

    def relaxed_arm(self, frame, s, interp='BEZIER'):
        self.pose(frame, interp, **{f'upperarm_{s}': (6, 3, 0), f'forearm_{s}': 18, f'hand_{s}': (6, 0, 0),
                                    f'fingers_{s}': 0.22, f'thumb_{s}': 0.15, f'shoulder_{s}': (0, 0, 0)})

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

    def attach_cup(self, frame, to='hand_R'):
        """Switch the cup between hands ('hand_R', 'hand_L') and the world (None).
        Call after the poses around `frame` are keyed."""
        cup = self.cup
        if cup is None:
            return
        cons = {'hand_R': 'hold_R', 'hand_L': 'hold_L'}
        # where is it right now (just before the switch)?
        sc = bpy.context.scene
        sc.frame_set(frame)
        dg = bpy.context.evaluated_depsgraph_get()
        now = cup.evaluated_get(dg).matrix_world.copy()
        if to is None:
            self._key_obj(cup, frame - 1, self._cup_rest, 'CONSTANT')
            self._key_obj(cup, frame, now, 'BEZIER')
            for cn in cons.values():
                self._key_influence(cup, cn, frame - 1, cup.constraints[cn].influence)
                self._key_influence(cup, cn, frame, 0.0)
            return
        rest_target = self._cup_rest if to == 'hand_R' else self._cup_rest_L
        W = self._attached_world(cup, self._cup_rest, to, frame, rest_target)
        self._key_obj(cup, frame - 1, W, 'CONSTANT')
        self._key_obj(cup, frame, self._cup_rest, 'CONSTANT')
        for key, cn in cons.items():
            self._key_influence(cup, cn, frame - 1, cup.constraints[cn].influence)
            self._key_influence(cup, cn, frame, 1.0 if key == to else 0.0)

    def detach_headset(self, frame):
        hs = self.headset
        if hs is None:
            return
        sc = bpy.context.scene
        sc.frame_set(frame)
        dg = bpy.context.evaluated_depsgraph_get()
        now = hs.evaluated_get(dg).matrix_world.copy()
        self._key_obj(hs, frame - 1, self._hs_rest, 'CONSTANT')
        self._key_obj(hs, frame, now, 'BEZIER')
        self._key_influence(hs, 'on_head', frame - 1, 1.0)
        self._key_influence(hs, 'on_head', frame, 0.0)

    def attach_headset(self, frame):
        hs = self.headset
        if hs is None:
            return
        W = self._attached_world(hs, self._hs_rest, 'head', frame)
        self._key_obj(hs, frame - 1, W, 'CONSTANT')
        self._key_obj(hs, frame, self._hs_rest, 'CONSTANT')
        self._key_influence(hs, 'on_head', frame - 1, 0.0)
        self._key_influence(hs, 'on_head', frame, 1.0)

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
        # cord: from the left cup down into the collar (follows the headset when it comes off)
        cs = b.cord_start
        hook_hs = [(cs, hs), (cs + V((0.018, -0.012, -0.05)), hs)]
        pts = hook_hs + [(V((0.066, -0.022, 1.36)), 'neck'), (V((0.05, -0.016, 1.30)), 'chest'),
                         (V((0.04, -0.01, 1.258)), 'chest')]
        b.hooked_cable('headset_cord', pts, 0.0021, b.mat['black'])
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
            fwd = hd['u']
            # cup local: Z = axis, -Y = sip spout direction (faces the fingers' side)
            zc = c
            yc = -(fwd - zc * fwd.dot(zc)).normalized()
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
