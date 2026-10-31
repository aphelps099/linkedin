"""S06 · f529-608 · the arch (E1_OFFLINE, day).

    blender -b --factory-startup -P shots/s06_arch.py -- --quality proof --only 529,541,545,549,553,566,578,608
    blender -b --factory-startup -P shots/s06_arch.py -- --quality final
    S06_LENS=50 blender ...      (the treatment's lens, with its own solved framing: see LENS below)

Inside the cup, following Kevin's padlock in. A 35 mm lens 2 m above the
espresso, locked off 90 m in front of the arch's left leg, on the line from the
landing through env_offline's 's06_land' camera: the leg climbs out of the top
of frame as a rim-lit column against the glowing paper, the open scree fan in
front of it. The padlock, now the size of a three-storey building, is in the
last second of a long drop from the slot-sun: it tumbles into frame (one turn
a second), its brass face flashing gold three times on the 16th-note grid,
bites into the scree (a 0.35 m heave and a 12-degree rock over its leading
edge, real gravity), slides and settles. Then one tilt and push climbs the
leg: brass at the foot, brown patina, chalky verdigris, lichen-crusted grey
stone at the crest, pines breaking the crest's silhouette, and it lands on the
whole arch with the slot-sun hanging in its opening, held to the cut.

Sync points (film frames; 90 BPM, a beat every 16 frames, 16th notes every 4):
  f529        the cut: the padlock is ~29 m above the scree, falling at 24 m/s, above the frame
  f535        it breaks the top edge (18 frames of fall on screen)
  f541, f545, f549   gold flashes off its broad face (f545 is beat 34's downbeat)
  f553        impact on the scree (the half-beat); dust and grit from f554
  f553-566    the bite: a 0.35 m heave (a 13-frame hop at real g) and a 12-degree rock over the leading
              edge, back down on f566
  f566-578    slide and settle (the f578 pose is env_offline's rest, which S08 holds)
  f560-600    tilt and push: a 20-frame ease-in, cruise, a 12-frame ease-out (peak see report());
              the camera stands still f600-608 on the slot-in-arch frame
The camera is locked off on f529-560.

Deviations from the treatment (composition and timing held):
  * lens 35 mm (treatment 50 mm), pending the director's approval: from under the arch 50 mm cannot hold
    both legs and the crest around the slot (the payoff shows a ring of verdigris around a lamp), and its
    tilt is 40% faster on screen. S06_LENS=50 renders the treatment's lens with its own solved framing
    (it ends 15 m further out, slot centred).
  * the cup world puts the slot 63-68 degrees above a lens at shore level in front of the arch, so the move
    tilts from about +18 to +65 degrees (not 25 -> 55) and pushes 43 m (90 m -> 55 m from the arch) to the
    env's 's06_arch' station. The slot only sits inside the opening from under the arch.
  * the padlock tumbles all the way down (the treatment: flashes at the top of the shaft, then falls
    straight) and its three flashes come from glossy-only glint discs where its face mirrors the hot
    slot-side paper on the flash frames: the cup's 6-degree key is too small a source to flash a flat face.
  * the hero's shackle is hardened steel, as Kevin's room padlock (props.padlock) in S05 and S09.
In-shot overrides of env_offline (reported to its owner): the hero's ground keys f553-578 (no 3.2 m hop),
the dust timing and motes, the scree puddles' roughness, the lichen rosettes' size and cores, a few pines
on the crest's visible rim.
"""

import json
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Euler, Quaternion, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'lib'))

import common as C  # noqa: E402
import env_offline as E  # noqa: E402

SHOT = 's06'
INFO = next(s for s in json.load(open(os.path.join(HERE, 'shots.json'))) if s['id'] == SHOT)
START, END = INFO['start'], INFO['end']

# ------------------------------------------------------------------ sync points (film frames)
LAND = 553              # strikes the scree (dust)
BOUNCE = 566            # the rock comes back down: contact
SETTLE = 578            # slid and settled (env_offline's rest pose, held by S08)
FLASHES = (541, 545, 549)   # the three gold flashes, on the 16th-note grid (f545: beat 34)
MOVE0, MOVE1 = 560, 601  # tilt up and push in (f601: a 16th); held f601-608
EASE_IN, EASE_OUT = 20, 10   # frames of the move's velocity ramps (smoothstep), cruise between

# ------------------------------------------------------------------ the fall
IMPACT = 34.0           # m/s at the scree, at real g: the shot sees the last second of the drop (29 m)
SPIN_TRY = (8.0, 9.0, 10.0, 11.0, 12.0, 13.0, 14.0, 15.0)   # deg/frame tumble (1 rev/s at 15): the slowest whose
                        # three flash mirrors all look into the glowing paper or lid with no stray flash is used
AXIS_TRY = (0.0, -20.0, 20.0, -40.0, 40.0, -60.0, 60.0)    # deg about Z from env_offline's tumble axis
MIRROR_MIN_Z = -0.05    # a flash mirror may not look lower than this (the cliff foot is 4-7 deg down)
HEAVE = 0.35            # m: the bite's rebound (a 13-frame hop at real g rises 0.36 m)
ROCK = 12.0             # deg: it tips over its leading edge and falls back (peak ~f559)
CLEAR_MIN_SCALE = 3.0   # m: loose scree padlocks at least this big are moved off the hero's slide path
DESCENT = 0.15          # m/frame: fastest the settle may sink (sliding off loose padlocks), else it floats
ASCENT = 0.30           # m/frame: fastest it may ride up over them

# ------------------------------------------------------------------ the flashes
GLINT_DIST = 600.0      # m: each glint disc stands out along its face's mirror direction on its flash frame
GLINT_HALF = 10.0       # deg: angular radius of a disc (a patch of hot slot-side paper)
GLINT_L = 5.5           # radiance (emission-strength units): x brass F0, a gold flash AgX keeps gold
GLINT_K = 2900.0        # colour temperature (warmer than the 3200K paper: the brass stays gold)

# ------------------------------------------------------------------ lens and camera
LENS = float(os.environ.get('S06_LENS', '35'))
LENS_SETUP = {
    35.0: dict(end_back=0.0, slot_y=0.42),     # the env's 's06_arch' station: the whole crest, its pines and the
                                               # lid above it, the slot in the upper half of the opening
    50.0: dict(end_back=0.0, slot_y=0.50),     # treatment lens: the same station, slot centred (from 8-20 m further
                                               # out the crest's underside hides the slot)
}
START_DIST = 60.0       # m from the hero's rest, on the line out through env 's06_land' (90 m from the leg)
HERO_XY = (0.40, 0.36)  # where the settled padlock sits in the opening frame (lower third, left of the leg)
CAM_Z = 2.0
SHUTTER = (0.5, 0.35)   # motion-blur shutter at rest and at the move's peak (keeps the cruise under ~25 px)
SEED_MOVE_DEG = 0.04    # camera turning faster than this (deg/frame), or pushing 3 cm/frame: animated seed
SENSOR = 36.0

# ------------------------------------------------------------------ look
FILL = 0.25             # warm bounce card on the arch's shaded face (both env framings)
WALL_BOUNCE = (0.42, 0.75)   # paper bounce on the world: the day default while locked off (the leg a rim-lit
                        # silhouette), rising with the move to the 's06_arch' value (the arch resolves into detail)
SCREE_PUDDLE_ROUGH = 0.28   # the wet scree's puddles (env 0.05 mirrors the lid like crumpled foil): a dull sheen
LOOK = dict(glare=0.6, glare_threshold=2.5, glare_rel_size=0.11)   # the slot-sun and the flashes bloom
DUST_GLOW = 1.0         # emission of the backlit dust puff (env 0.45)
MOTES_KEEP = 16         # of env's 40 dust motes: fewer, smaller, darker grit (not snow)
MOTE_COL, MOTE_GLOW, MOTE_SCALE = (0.52, 0.36, 0.21), 0.45, 0.6
ROSETTE_SCALE = 5.0     # lichen rosette cells (env 9.5): fewer, larger clumps
BRASS_ROUGH = (0.21, 0.12)   # young brass roughness base and noise (env 0.17, 0.08): rib reflections break up
LICHEN_FROST, LICHEN_CORE, LICHEN_GATE = 0.47, 0.27, (0.28, 0.44)   # env 0.38, 0.15, (0.40, 0.56)
RIM_PINES = 14          # pines planted on the crest's visible rim (tips against the lid in the end frame)
SLOT_FLARE = 0.16       # the lid hole's flare behind the slot plane (env 0.085, tuned for S01's lens)

PARTS = {'cup', 'lid', 'shaft', 'sea', 'floes', 'arch', 'hero_padlock', 'blooms', 'gravity'}


# ================================================================== camera

def cam_rot(yaw, pitch):
    return Euler((math.pi / 2 + pitch, 0.0, yaw - math.pi / 2), 'XYZ')


def project_yp(loc, yaw, pitch, P, lens=LENS):
    """Frame position (0..1, 0..1) of world point P for a camera at loc with yaw/pitch (16:9, 36 mm wide)."""
    d = cam_rot(yaw, pitch).to_matrix().transposed() @ (Vector(P) - Vector(loc))
    if d.z >= -1e-6:
        return float('nan'), float('nan')
    return (d.x / -d.z) * lens / SENSOR + 0.5, (d.y / -d.z) * lens / (SENSOR * 9 / 16) + 0.5


def aim(loc, P, xy, lens=LENS):
    """Yaw and pitch that put world point P at frame position xy."""
    d = Vector(P) - Vector(loc)
    yaw, pitch = math.atan2(d.y, d.x), math.atan2(d.z, d.to_2d().length)
    for _ in range(30):
        x, y = project_yp(loc, yaw, pitch, P, lens)
        e = 1e-5
        x1, y1 = project_yp(loc, yaw + e, pitch, P, lens)
        x2, y2 = project_yp(loc, yaw, pitch + e, P, lens)
        J = np.array([[(x1 - x) / e, (x2 - x) / e], [(y1 - y) / e, (y2 - y) / e]])
        dy, dp = np.linalg.solve(J, np.array([xy[0] - x, xy[1] - y]))
        yaw, pitch = yaw + dy, pitch + dp
    return yaw, pitch


def trapezoid(t, T, a, b):
    """0..1 travelled at time t (0..T) under a velocity that ramps up over a (smoothstep), cruises, and
    ramps down over b: a linear cruise between gentle starts and stops."""
    vmax = 1.0 / (T - 0.5 * a - 0.5 * b)
    t = min(max(t, 0.0), T)

    def ramp(x):                         # integral of smoothstep over 0..x
        return x ** 3 - 0.5 * x ** 4
    if t <= a:
        return vmax * a * ramp(t / a)
    if t <= T - b:
        return vmax * (0.5 * a + t - a)
    x = (t - (T - b)) / b
    return vmax * (0.5 * a + (T - b - a) + b * (x - ramp(x)))


class Move:
    """Locked off until MOVE0, then one tilt and push (trapezoidal velocity) onto the slot-in-arch frame,
    held from MOVE1. Locations are known at once (the floes need the path); aim() is solved once the
    hero exists (solve())."""

    def __init__(self, lens=LENS):
        self.lens = lens
        cfg = LENS_SETUP[lens]
        rest = E.hero_padlock_rest()
        out = (E.CAM_S06_START - rest).to_2d().normalized()
        self.p0 = rest + Vector((out.x, out.y, 0.0)) * START_DIST
        self.p0.z = CAM_Z
        self.p1 = E.CAM_S06 + E.ARCH_FACE * cfg['end_back']
        self.p1.z = CAM_Z
        self.slot_y = cfg['slot_y']
        self.y0 = self.t0 = self.y1 = self.t1 = 0.0
        self.sea_focus = tuple(self.p0.lerp(self.p1, 0.5).to_2d())

    def solve(self, hero_centre):
        self.y0, self.t0 = aim(self.p0, hero_centre, HERO_XY, self.lens)
        self.y1, self.t1 = aim(self.p1, E.SLOT_C, (0.5, self.slot_y), self.lens)

    def u(self, f):
        return trapezoid(f - MOVE0, MOVE1 - MOVE0, EASE_IN, EASE_OUT)

    def state(self, f):
        u = self.u(f)
        return self.p0.lerp(self.p1, u), self.y0 + (self.y1 - self.y0) * u, self.t0 + (self.t1 - self.t0) * u

    def euler(self, f):
        _loc, yaw, pitch = self.state(f)
        return cam_rot(yaw, pitch)

    def turn_deg(self, f):
        """How far the view direction turns between f-1 and f (degrees)."""
        _l, ya, pa = self.state(f - 1)
        _l, yb, pb = self.state(f)
        return math.degrees(math.hypot((yb - ya) * math.cos(0.5 * (pa + pb)), pb - pa))

    def push(self, f):
        return (self.state(f)[0] - self.state(f - 1)[0]).length

    def project(self, f, P):
        loc, yaw, pitch = self.state(f)
        return project_yp(loc, yaw, pitch, P, self.lens)

    def path_xy(self, n=8):
        return [tuple(self.p0.lerp(self.p1, i / (n - 1)).to_2d()) for i in range(n)]


def build_camera(move):
    cam = E.camera_offline(move.lens, move.p0, move.p0 + Vector((0, 1, 0)), fstop=0.0)
    cam.rotation_mode = 'XYZ'
    for f in range(START - 2, END + 3):
        loc, _y, _p = move.state(f)
        cam.location = loc
        cam.rotation_euler = move.euler(f)
        cam.keyframe_insert('location', frame=f)
        cam.keyframe_insert('rotation_euler', frame=f)
    for fc in C.fcurves(cam.animation_data.action):
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'
    return cam


# ================================================================== the hero padlock

def _hero_centre_local(hp):
    """The hero's vertex centroid in its local frame, scaled (rotate it and add the location)."""
    return Vector(E._hero_local_verts(hp).mean(0))


def _linear(obj):
    for fc in C.fcurves(obj.animation_data.action):
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'


def retumble(h, spin, axis=None):
    """Re-key the visible fall's tumble at `spin` deg/frame (env_offline keys 1.5 turns over the second).

    The centre path and the landing pose (f553) stay as animate_hero_padlock solved them; only the spin
    before the landing changes, about `axis` (default: the env's tumble axis), so the padlock lands on the
    same frame in the same orientation. The swept volume is checked against the arch with env_offline's
    own clearance test; if it would cut the leg, False is returned and nothing is keyed.
    """
    hp = h['objects']['hero_padlock']
    sc = bpy.context.scene
    Vl = E._hero_local_verts(hp)
    cl = Vector(Vl.mean(0))
    axis = (Vector(axis) if axis is not None else Vector(E.ARCH_SPAN) * 0.8 + Vector((0, 0, 0.35))).normalized()
    path = h.setdefault('s06_fall_path', [])
    if not path:
        for f in range(START, LAND + 1):
            sc.frame_set(f)
            q = hp.rotation_quaternion.copy()
            path.append((f, hp.location + q.to_matrix() @ cl, q))
    q_land = path[-1][2]
    keys = []
    for f, c, _q in path[:-1]:
        q = Quaternion(axis, math.radians(spin) * (LAND - f)) @ q_land
        keys.append((f, c - q.to_matrix() @ cl, q))
    walls = h.get('s06_walls')
    if walls is None and h.get('arch') is not None:
        walls = h['s06_walls'] = E._arch_bvh(h['arch'], path[-1][1])
    if walls is not None and any(E._hero_hits(Vl, loc, q, walls) for f, loc, q in keys):
        return False
    prev = None
    for f, loc, q in keys:
        if prev is not None and prev.dot(q) < 0:
            q = -q
        prev = q
        hp.location = loc
        hp.rotation_quaternion = q
        hp.keyframe_insert('location', frame=f)
        hp.keyframe_insert('rotation_quaternion', frame=f)
    _linear(hp)
    sc.frame_set(START)
    return True


def _face_mirrors(hp, cam_loc):
    """Mirror directions of the hero's camera-facing broad faces (template +-Y), and the body centre."""
    M = hp.matrix_world
    R3 = M.to_3x3().normalized()
    c = M @ Vector((0.0, 0.0, 0.26))
    v = (c - cam_loc).normalized()
    out = []
    for sgn in (1.0, -1.0):
        n = (R3 @ Vector((0.0, sgn, 0.0))).normalized()
        if n.dot(v) < -0.05:
            out.append(v - 2.0 * v.dot(n) * n)
    return out, c


def plan_flashes(h, cam):
    """Pick the tumble (rate and axis) and the glint discs: on each FLASHES frame the camera-facing broad face
    mirrors a disc out in the glowing paper or lid (mirror direction above the cliff foot, z > MIRROR_MIN_Z);
    on every other quarter frame with the padlock in frame no face mirror comes within a disc (no stray
    flash). The slowest clean tumble wins, then the highest mirrors. Returns (spin, axis, discs) and keys it."""
    hp = h['objects']['hero_padlock']
    sc = bpy.context.scene
    margin = math.radians(GLINT_HALF + 4.0)
    env_axis = (Vector(E.ARCH_SPAN) * 0.8 + Vector((0, 0, 0.35))).normalized()
    cands = []
    for spin in SPIN_TRY:
        for turn in AXIS_TRY:
            axis = (Euler((0.0, 0.0, math.radians(turn))).to_matrix() @ env_axis).normalized()
            if not retumble(h, spin, axis):
                print(f'S06 tumble {spin} deg/frame axis {turn:+.0f}: cuts the arch', flush=True)
                continue
            discs, zs = [], []
            for fk in FLASHES:
                sc.frame_set(fk)
                rs, c = _face_mirrors(hp, cam.matrix_world.translation)
                r = max(rs, key=lambda r: r.z) if rs else None
                zs.append(round(r.z, 2) if r is not None else None)
                if r is not None:
                    discs.append((fk, c, r))
            if len(discs) < len(FLASHES) or min(d[2].z for d in discs) < MIRROR_MIN_Z:
                print(f'S06 tumble {spin} deg/frame axis {turn:+.0f}: mirror z {zs}', flush=True)
                continue
            stray = []
            for i in range(4 * (LAND + 1 - START)):
                t = START + i / 4.0
                sc.frame_set(int(t), subframe=t - int(t))
                x, y, z = project(cam, hp.matrix_world @ Vector((0, 0, 0.4)))
                if not (-0.05 < x < 1.05 and -0.05 < y < 1.05):
                    continue
                rs, _c = _face_mirrors(hp, cam.matrix_world.translation)
                for fk, _c2, d in discs:
                    if abs(t - fk) > 0.75 and any(r.angle(d) < margin for r in rs):
                        stray.append(round(t, 2))
            print(f'S06 tumble {spin} deg/frame axis {turn:+.0f}: mirror z {zs} stray {stray}', flush=True)
            if not stray:
                cands.append((spin, -min(d[2].z for d in discs), turn, axis, discs))
        if cands:
            break
    if not cands:
        raise RuntimeError('S06: no tumble gives three clean flashes')
    spin, _z, turn, axis, discs = min(cands, key=lambda c: (c[0], c[1]))
    retumble(h, spin, axis)
    sc.frame_set(START)
    print(f'S06 tumble chosen: {spin} deg/frame, axis turned {turn:+.0f} deg from the env axis', flush=True)
    return spin, axis, discs


def build_glints(h, discs):
    """One glossy-only disc per flash, seen (and shadowed) by the hero padlock alone."""
    hp = h['objects']['hero_padlock']
    rc = bpy.data.collections.new('S06_GlintLink')        # not in the scene: a link set
    rc.objects.link(hp)
    size = 2 * GLINT_DIST * math.tan(math.radians(GLINT_HALF))
    area = math.pi * (size / 2) ** 2
    lights = []
    for fk, c, d in discs:
        L = C.area_light(f'S06_HeroGlint_{fk}', c + d * GLINT_DIST, target=c, energy=GLINT_L * math.pi * area, size=size,
                         shape='DISK', color=E.kelvin(GLINT_K))
        E._light_vis(L, camera=False, diffuse=False, glossy=True, transmission=False)
        L.data.cycles.max_bounces = 1
        L.light_linking.receiver_collection = rc
        L.light_linking.blocker_collection = rc
        lights.append(L)
    return lights


def ground_path(h):
    """The hero's ground motion f553-578 before heights: one decelerating slide from the landing pose
    (f553) to env_offline's rest pose (f578), with the bite superposed on f553-566 (a ROCK-degree tip over
    the leading edge and back, a HEAVE m rebound). Quarter-frame samples (the motion-blur times)."""
    hp = h['objects']['hero_padlock']
    sc = bpy.context.scene
    sc.frame_set(LAND)
    L_loc, L_q = hp.location.copy(), hp.rotation_quaternion.copy()
    sc.frame_set(SETTLE)
    R_loc, R_q = hp.location.copy(), hp.rotation_quaternion.copy()
    sc.frame_set(START)
    if R_q.dot(L_q) < 0:
        R_q = -R_q
    Vl = E._hero_local_verts(hp)
    m = Vector(((R_loc - L_loc).x, (R_loc - L_loc).y, 0.0)).normalized()
    rock_axis = Vector((0, 0, 1)).cross(m).normalized()
    T, XY, Q, H = [], [], [], []
    for i in range((SETTLE - LAND) * 4 + 1):
        t = LAND + i / 4.0
        e = 1.0 - (1.0 - (t - LAND) / float(SETTLE - LAND)) ** 2      # sliding friction: constant deceleration
        base_xy = L_loc.lerp(R_loc, e)
        q_base = L_q.slerp(R_q, e)
        s = min(1.0, (t - LAND) / float(BOUNCE - LAND))
        q = Quaternion(rock_axis, math.radians(ROCK) * math.sin(math.pi * s)) @ q_base
        W = Vl @ np.array(q_base.to_matrix()).T          # pivot on the leading edge: it keeps its place
        k = int(np.argmax(W @ np.array(m) - 0.6 * W[:, 2]))
        e0 = q_base.to_matrix() @ Vector(Vl[k])
        e1 = q.to_matrix() @ Vector(Vl[k])
        xy = base_xy + Vector((e0.x - e1.x, e0.y - e1.y, 0.0))
        if Q and Q[-1].dot(q) < 0:
            q = -q
        T.append(t)
        XY.append(xy)
        Q.append(q)
        H.append(HEAVE * 4 * s * (1 - s))
    XY[-1], Q[-1] = R_loc.copy(), R_q
    return dict(L=L_loc, Lq=L_q, R=R_loc, Rq=R_q, T=T, XY=XY, Q=Q, H=H, Vl=Vl, m=m)


def _scree_owner(arch, a, b, radius):
    """Instance index of every triangle in env_offline._scree_bvh(arch, a, b, radius)."""
    pts, rots, scl, var = arch['scree_data']
    mid = (Vector(a) + Vector(b)) * 0.5
    sel = np.nonzero(np.hypot(pts[:, 0] - mid.x, pts[:, 1] - mid.y) < radius)[0]
    tm = [E._template_tris(o) for o in arch['templates']]
    return np.concatenate([np.full(len(tm[int(var[i]) % len(tm)][1]), i) for i in sel]) if len(sel) else np.zeros(0, int)


def clear_slide_path(h, gp):
    """Loose scree padlocks of CLEAR_MIN_SCALE m or more that the slide would run into are moved aside, off
    its path, on the mound (env_offline clears a corridor round the path's centre line; the 11 m body is
    wider). Smaller rubble stays: the hero rides over it (lift_clear)."""
    hp = h['objects']['hero_padlock']
    arch = h['arch']
    pts, rots, scl, var = arch['scree_data']
    n_sp = len(arch['scree'].data.vertices)
    radius = 45.0
    bvh = E._scree_bvh(arch, gp['L'], gp['R'], radius=radius)
    owner = _scree_owner(arch, gp['L'], gp['R'], radius)
    poses = []
    for xy, q in zip(gp['XY'], gp['Q']):
        poses.append(E._hero_bvh(gp['Vl'], E._sit_on_scree(hp, Vector((xy.x, xy.y, 0.0)), q), q, inflate=1.03))
    hit = set()
    for hb in poses:
        hit.update(int(owner[i]) for i, _j in bvh.overlap(hb))
    tm = [E._template_tris(o) for o in arch['templates']]
    a2, b2 = gp['L'].to_2d(), gp['R'].to_2d()
    moved = []
    for j in sorted(hit):
        if scl[j] < CLEAR_MIN_SCALE:
            continue
        V, F = tm[int(var[j]) % len(tm)]
        p = Vector(pts[j])
        ab = b2 - a2
        c = a2 + ab * max(0.0, min(1.0, (p.to_2d() - a2).dot(ab) / ab.length_squared))
        d = p.to_2d() - c
        d = d.normalized() if d.length > 1e-3 else Vector((gp['m'].y, -gp['m'].x))
        for step in np.arange(1.0, 16.0, 1.0):
            q2 = p.to_2d() + d * step
            dz = float(E.mound_h(np.array([q2.x]), np.array([q2.y]))[0] - E.mound_h(np.array([p.x]), np.array([p.y]))[0])
            p2 = np.array([q2.x, q2.y, p.z + dz])
            ib = E._bvh_from((V * scl[j]) @ rots[j].T + p2, F)
            if not any(ib.overlap(hb) for hb in poses):
                pts[j] = p2
                if j < n_sp:
                    arch['scree'].data.vertices[j].co = p2
                else:
                    arch['rubble'].data.vertices[j - n_sp].co = p2
                moved.append((j, round(float(scl[j]), 1), float(step)))
                break
        else:
            print(f'S06 WARNING scree padlock {j} ({scl[j]:.1f} m) could not be moved off the slide path', flush=True)
    arch['scree'].data.update()
    arch['rubble'].data.update()
    print(f'S06 slide path: moved {moved} (index, size m, metres aside)', flush=True)
    return moved


def rekey_ground(h, gp):
    """Heights for the ground path, and its keys. Every quarter frame is solved on the mound (lowest vertex
    on the surface) and lifted clear of the loose scree; the height then follows a slope-limited envelope
    over that floor plus the heave (it never sinks faster than DESCENT or climbs faster than ASCENT
    m/frame), so there is no pop and nothing passes through. f553 and f578 keep env_offline's poses exactly
    (S08 holds the rest). Keys on quarter frames (the motion-blur samples), then checked for overlaps."""
    hp = h['objects']['hero_padlock']
    sc = bpy.context.scene
    arch = h['arch']
    Vl = gp['Vl']
    scree = E._scree_bvh(arch, gp['L'], gp['R'], radius=45.0)
    walls = h.get('s06_walls') or E._arch_bvh(arch, gp['L'])
    T, XY, Q, H = gp['T'], gp['XY'], gp['Q'], gp['H']
    Z = []
    for xy, q in zip(XY, Q):
        loc = E._sit_on_scree(hp, Vector((xy.x, xy.y, 0.0)), q)
        Z.append(E._lift_clear(Vl, loc, q, scree).z if scree is not None else loc.z)
    L_loc, R_loc = gp['L'], gp['R']
    print(f'S06 ground floor: f553 {Z[0]:.2f} (env {L_loc.z:.2f}) f578 {Z[-1]:.2f} (env {R_loc.z:.2f})', flush=True)
    Z[0], Z[-1] = L_loc.z, R_loc.z
    zf = np.array(Z) + np.array(H)
    env = zf.copy()
    for i in range(1, len(env)):                 # never sink faster than DESCENT
        env[i] = max(env[i], env[i - 1] - DESCENT / 4.0)
    for i in range(len(env) - 2, -1, -1):        # never climb faster than ASCENT
        env[i] = max(env[i], env[i + 1] - ASCENT / 4.0)
    drift = env[-1] - R_loc.z
    if abs(drift) > 1e-3:
        print(f'S06 WARNING settle envelope ends {drift:.2f} m off the rest height', flush=True)
    for t, xy, q, z in zip(T, XY, Q, env):
        hp.location = Vector((xy.x, xy.y, float(z)))
        hp.rotation_quaternion = q
        hp.keyframe_insert('location', frame=t)
        hp.keyframe_insert('rotation_quaternion', frame=t)
    _linear(hp)
    # verify: quarter frames from the last fall sample to just past the settle
    n = len(T) - 1
    hits = []
    for i in range(-1, n + 2):
        t = LAND + i / 4.0
        sc.frame_set(int(math.floor(t)), subframe=t - math.floor(t))
        loc, q = hp.location.copy(), hp.rotation_quaternion.copy()
        hs = len(scree.overlap(E._hero_bvh(Vl, loc, q, inflate=1.0))) if scree is not None else 0
        ha = E._hero_hits(Vl, loc, q, walls)
        if hs or ha:
            hits.append((t, hs, ha))
    lift = env - np.array(Z)
    j = int(np.argmax(env - zf))
    print(f'S06 ground: land z {L_loc.z:.2f} rest z {R_loc.z:.2f} | floor max {max(Z):.2f} | envelope above floor+heave '
          f'max {float((env - zf).max()):.2f} m at f{T[j]:.2f} | heave+envelope max {float(lift.max()):.2f} m | '
          f'overlaps {hits if hits else "none"}', flush=True)
    h['s06_ground'] = dict(T=T, floor=Z, z=list(env), hits=hits)
    sc.frame_set(START)
    return hits


def steel_shackle(h):
    """Kevin's padlock has a hardened-steel shackle in the room (props.shackle_steel): the hero's U (the
    tube and its end caps, polygons after the body box) gets a dark brushed steel; the collars stay brass."""
    hp = h['objects']['hero_padlock']
    nb = len(E._rounded_box(0.31, 0.13, 0.26, 0.07, n=12)[1])
    sides, rings = 12, 34 + 4
    n_tube = sides * (rings - 1) + 2 * sides
    m = E.new_mat('S06_HeroShackle')
    g = E.G(m)
    p = g.texco('Object')
    n = g.noise(g.mapping(p, scale=(24.0,) * 3), 1.0, 3.0, 0.5)
    tarn = g.remap(g.noise(g.mapping(p, scale=(7.0,) * 3, loc=(3, 1, 2)), 1.0, 4.0, 0.6), 0.5, 0.78)
    col = g.mix(g.mul(tarn, 0.7), (0.50, 0.50, 0.51), (0.30, 0.26, 0.21))
    brush = g.noise(g.mapping(p, scale=(90.0, 90.0, 6.0)), 1.0, 2.0, 0.5)
    col = g.mix(g.mul(g.remap(brush, 0.45, 0.65), 0.12), col, (0.68, 0.68, 0.69))
    rough = g.add(0.2, g.mul(n, 0.08), g.mul(tarn, 0.16))
    nrm = g.bump(g.add(g.mul(n, 0.3), g.mul(brush, 0.25)), strength=0.12, distance=0.02)
    g.output(g.principled(Base_Color=col, Metallic=1.0, Roughness=rough, Normal=nrm))
    hp.data.materials.append(m)
    idx = np.zeros(len(hp.data.polygons), dtype=np.int32)
    idx[nb:nb + n_tube] = 1
    hp.data.polygons.foreach_set('material_index', idx)
    hp.data.update()
    return m


# ================================================================== look overrides

def soften_puddles(h):
    """In-shot override of the scree material: its puddle roughness (a float Mix 0.42 -> 0.05)."""
    mat = h['mats'].get('scree')
    done = 0
    for n in (mat.node_tree.nodes if mat else ()):
        if n.bl_idname == 'ShaderNodeMix' and n.data_type == 'FLOAT':
            a = next(i for i in n.inputs if i.identifier == 'A_Float')
            b = next(i for i in n.inputs if i.identifier == 'B_Float')
            if not a.is_linked and not b.is_linked and abs(a.default_value - 0.42) < 1e-4 and abs(b.default_value - 0.05) < 1e-4:
                b.default_value = SCREE_PUDDLE_ROUGH
                done += 1
    if done != 1:
        print(f'S06 WARNING soften_puddles changed {done} nodes (expected 1)', flush=True)


def glow_dust(h):
    """In-shot override of the dust puff material: its emission strength (env 0.45)."""
    mat = h['mats'].get('dust')
    em = [n for n in (mat.node_tree.nodes if mat else ()) if n.bl_idname == 'ShaderNodeEmission']
    if len(em) != 1 or abs(em[0].inputs['Strength'].default_value - 0.45) > 1e-4:
        print(f'S06 WARNING glow_dust found {len(em)} emission nodes: dust left as built', flush=True)
        return
    em[0].inputs['Strength'].default_value = DUST_GLOW


def _rekey(sock, keys):
    """Replace a material value socket's animation with (frame, value, interp) keys."""
    tree = sock.id_data
    ad = tree.animation_data
    path = sock.path_from_id('default_value')
    if ad and ad.action:
        for fc in list(C.fcurves(ad.action)):
            if fc.data_path == path:
                while len(fc.keyframe_points):
                    fc.keyframe_points.remove(fc.keyframe_points[0])
    for f, v, interp in keys:
        E.key_value(sock, f, v, interp)


def retime_dust(h):
    """The puff breaks above the scree on the impact (scale 0.3 on f554, bases lifted 2 m) and is gone
    before the tilt peaks; the motes are fewer, smaller, darker warm grit that drop out fast."""
    sc = bpy.context.scene
    cards = [o for o in h['objects'].get('dust', ()) if not o.get('mote')]
    motes = [o for o in h['objects'].get('dust', ()) if o.get('mote')]
    for o in cards:
        sc.frame_set(LAND + 34)
        s_end, loc_end = o.scale.copy(), o.location.copy()
        sc.frame_set(LAND)
        loc0 = o.location.copy()
        s = s_end.x
        o.animation_data_clear()
        lift = Vector((0, 0, 2.0))
        for f, sv in ((LAND, (0.01, 0.01, 0.01)), (LAND + 1, (0.3 * s, 0.3 * s, 0.25 * s)),
                      (LAND + 4, (0.55 * s, 0.55 * s, 0.45 * s)), (LAND + 34, tuple(s_end))):
            o.scale = sv
            o.keyframe_insert('scale', frame=f)
        o.location = loc0 + lift
        o.keyframe_insert('location', frame=LAND)
        o.location = loc_end + lift
        o.keyframe_insert('location', frame=LAND + 34)
        for fc in C.fcurves(o.animation_data.action):
            for kp in fc.keyframe_points:
                kp.interpolation = 'BEZIER'
                kp.easing = 'EASE_OUT'
    dm = h['mats'].get('dust')
    if dm is not None:
        _rekey(dm.node_tree.nodes['DustAlpha'].outputs[0],
               [(LAND, 0.0, 'LINEAR'), (LAND + 1, 0.8, 'BEZIER'), (LAND + 7, 0.55, 'BEZIER'), (LAND + 19, 0.0, 'BEZIER')])
    if motes:
        mm = motes[0].active_material
        nt = mm.node_tree
        em = next(n for n in nt.nodes if n.bl_idname == 'ShaderNodeEmission')
        em.inputs['Color'].default_value = (*MOTE_COL, 1.0)
        em.inputs['Strength'].default_value = MOTE_GLOW
        _rekey(nt.nodes['DustAlpha'].outputs[0],
               [(LAND, 0.0, 'LINEAR'), (LAND + 2, 0.85, 'BEZIER'), (LAND + 8, 0.5, 'BEZIER'), (LAND + 17, 0.0, 'BEZIER')])
        for i, o in enumerate(motes):
            if i >= MOTES_KEEP:
                o.hide_render = True
                o.hide_viewport = True
                continue
            for fc in C.fcurves(o.animation_data.action):
                if fc.data_path == 'scale':
                    for kp in fc.keyframe_points:
                        kp.co.y *= MOTE_SCALE
                        kp.handle_left.y *= MOTE_SCALE
                        kp.handle_right.y *= MOTE_SCALE
    sc.frame_set(START)


def lichen(h):
    """In-shot override of the arch padlocks' material: in the oldest stage fewer, larger rosettes
    (ROSETTE_SCALE), wider frost-grey crust and bigger chartreuse cores, gated by a looser noise so they
    clump, not print; on the young brass a little more roughness, so the lid's ribs no longer mirror
    as a clean crescent on a face plate."""
    mat = h['mats'].get('padlock')
    nt = mat.node_tree if mat else None
    done = []
    for n in (nt.nodes if nt else ()):
        if n.bl_idname == 'ShaderNodeMapping' and tuple(round(v, 3) for v in n.inputs['Scale'].default_value) == (9.5, 9.5, 9.5):
            n.inputs['Scale'].default_value = (ROSETTE_SCALE,) * 3
            done.append('scale')
        if n.bl_idname == 'ShaderNodeMapRange' and n.inputs[1].is_linked and not n.inputs[2].is_linked:
            src = n.inputs[1].links[0].from_node
            if src.bl_idname != 'ShaderNodeMath' or src.operation != 'ADD' or src.inputs[0].is_linked:
                continue
            a0, fmax = src.inputs[0].default_value, n.inputs[2].default_value
            if abs(a0 - 0.38) < 1e-4 and abs(fmax - 0.27) < 1e-4:
                src.inputs[0].default_value = LICHEN_FROST
                done.append('frost')
            elif abs(a0 - 0.15) < 1e-4 and abs(fmax - 0.07) < 1e-4:
                src.inputs[0].default_value = LICHEN_CORE
                done.append('core')
        if (n.bl_idname == 'ShaderNodeMapRange' and not n.inputs[1].is_linked and not n.inputs[2].is_linked
                and abs(n.inputs[1].default_value - 0.4) < 1e-4 and abs(n.inputs[2].default_value - 0.56) < 1e-4):
            n.inputs[1].default_value, n.inputs[2].default_value = LICHEN_GATE
            done.append('gate')
        if (n.bl_idname == 'ShaderNodeMath' and n.operation == 'ADD' and not n.inputs[0].is_linked and n.inputs[1].is_linked
                and abs(n.inputs[0].default_value - 0.17) < 1e-4):
            src = n.inputs[1].links[0].from_node
            if src.bl_idname == 'ShaderNodeMath' and src.operation == 'MULTIPLY' and abs(src.inputs[1].default_value - 0.08) < 1e-4:
                n.inputs[0].default_value, src.inputs[1].default_value = BRASS_ROUGH
                done.append('brass')
    if sorted(done) != ['brass', 'core', 'frost', 'gate', 'scale']:
        print(f'S06 WARNING lichen override found {sorted(done)}', flush=True)


def flare_slot(h):
    """The lid's hole flares behind the slot plane (env: a cone for the S01 lens); from under the arch the
    lens looks through it 30 degrees off that axis and saw a sliver of the cut wall as a grey lobe."""
    nt = h['mats']['lid'].node_tree
    for n in nt.nodes:
        if (n.bl_idname == 'ShaderNodeMath' and n.operation == 'MULTIPLY' and n.inputs[0].is_linked
                and not n.inputs[1].is_linked and abs(n.inputs[1].default_value - 0.085) < 1e-5):
            n.inputs[1].default_value = SLOT_FLARE
            return True
    print('S06 WARNING flare_slot found no flare node', flush=True)
    return False


def rim_pines(h, move):
    """A fringe of small pines on the arch's outline as the end frame sees it against the lid. From under
    the arch the crest's top face (where env_offline plants its pines) is hidden, so these grow out of the
    rim itself: rooted just inside the silhouette, leaning out and up, their crowns in profile against the
    ribbed lid. Placed by ray casting the end camera's top silhouette (the crest and the shoulders)."""
    arch = h['arch']
    loc, yaw, pitch = move.state(END)
    R = cam_rot(yaw, pitch).to_matrix()
    bvh = E._arch_bvh(arch, E.arch_crest(), radius=110.0)

    def ray(x, y):
        d = R @ Vector(((x - 0.5) * SENSOR / move.lens, (y - 0.5) * SENSOR * 9 / 16 / move.lens, -1.0))
        return d.normalized()

    sil = []
    for x in np.linspace(0.03, 0.97, 160):
        for y in np.arange(0.995, 0.45, -0.003):
            hit = bvh.ray_cast(loc, ray(x, y), 2000.0)
            if hit[0] is not None:
                sil.append((float(x), float(y), hit[0].copy(), hit[1].copy()))
                break
    rng = np.random.default_rng(83)
    order = rng.permutation(len(sil))
    chosen = []
    for i in order:
        x, y, P, N = sil[i]
        if N.z < -0.35 or y < 0.5:
            continue
        if any(abs(x - c[0]) < 0.035 for c in chosen):
            continue
        up = (Vector((0.0, 0.0, 0.75)) + N * 0.65).normalized()
        hgt = float(np.clip(rng.lognormal(math.log(5.0), 0.25), 3.5, 7.5))
        tip = P + up * hgt
        tx, ty = project_yp(loc, yaw, pitch, tip, move.lens)
        if not (0.02 < tx < 0.98 and 0.02 < ty < 0.985):
            continue
        d = (tip - loc)
        if bvh.ray_cast(loc, d.normalized(), d.length - 0.3)[0] is not None:
            continue
        chosen.append((x, y, P - N * 0.4, up, hgt))
        if len(chosen) >= RIM_PINES:
            break
    if not chosen:
        print('S06 rim pines: none', flush=True)
        return None
    k = len(chosen)
    pts = np.array([tuple(c[2]) for c in chosen])
    ups = np.array([tuple(c[3]) for c in chosen])
    rot = E.frame_from(ups, np.c_[np.cos(rng.uniform(0, 6.3, k)), np.sin(rng.uniform(0, 6.3, k)), np.zeros(k)])
    ob = E.instancer('S06_RimPines', pts, E.pine_templates(h['mats']), rot=rot, scl=np.array([c[4] for c in chosen]),
                     var=rng.integers(0, 3, k), coll=bpy.data.collections.get('OFFLINE'))
    print(f'S06 rim pines: {k} on a silhouette of {len(sil)} columns, frame '
          f'{sorted((round(c[0], 2), round(c[1], 2)) for c in chosen)}', flush=True)
    return ob


# ================================================================== keys

def key_bounce(h, move):
    """WallBounce follows the move: WALL_BOUNCE[0] until the tilt starts, WALL_BOUNCE[1] when it lands."""
    node = h['mats']['wall'].node_tree.nodes['WallBounce']
    a, b = WALL_BOUNCE
    for f in [START - 2] + list(range(MOVE0, MOVE1 + 1)) + [END + 2]:
        E.key_value(node, f, a + (b - a) * move.u(f))


def key_shutter(sc, move):
    """A shorter shutter while the lens turns fast (blur under ~25 px at 1600 wide), 0.5 otherwise."""
    peak = max(move.turn_deg(f) for f in range(MOVE0, MOVE1 + 1))
    for f in range(START - 2, END + 3):
        w = move.turn_deg(f) / peak if peak > 0 else 0.0
        w = w * w * (3 - 2 * w)
        sc.render.motion_blur_shutter = SHUTTER[0] + (SHUTTER[1] - SHUTTER[0]) * w
        sc.render.keyframe_insert('motion_blur_shutter', frame=f)


def key_seed(sc, move):
    """Fixed sampling seed while the lens is still (nothing static boils), animated while it moves
    (no noise pattern stuck to the screen as the world slides through it)."""
    cy = sc.cycles
    cy.use_animated_seed = False
    for f in range(START - 2, END + 3):
        nxt = min(f + 1, END)
        moving = max(move.turn_deg(f), move.turn_deg(nxt)) > SEED_MOVE_DEG or max(move.push(f), move.push(nxt)) > 0.03
        cy.seed = f if moving else 0
        cy.keyframe_insert('seed', frame=f)
    if sc.animation_data and sc.animation_data.action:
        for fc in C.fcurves(sc.animation_data.action):
            if fc.data_path == 'cycles.seed':
                for kp in fc.keyframe_points:
                    kp.interpolation = 'CONSTANT'


def project(cam, p):
    from bpy_extras.object_utils import world_to_camera_view
    v = world_to_camera_view(bpy.context.scene, cam, Vector(p))
    return v.x, v.y, v.z


def report(h, cam, move, spin):
    """Where the hero padlock and the slot sit in frame at the sync points, and the move's speed."""
    sc = bpy.context.scene
    hp = h['objects']['hero_padlock']
    hfov = 2 * math.degrees(math.atan(SENSOR / 2 / move.lens))
    vfov = 2 * math.degrees(math.atan(SENSOR * 9 / 32 / move.lens))
    peak_f = max(range(MOVE0, MOVE1 + 1), key=move.turn_deg)
    peak = move.turn_deg(peak_f)
    print(f'S06 lens {move.lens:.0f} mm | start {tuple(round(v, 1) for v in move.p0)} yaw {math.degrees(move.y0):.1f} '
          f'pitch {math.degrees(move.t0):.1f} | end {tuple(round(v, 1) for v in move.p1)} yaw {math.degrees(move.y1):.1f} '
          f'pitch {math.degrees(move.t1):.1f} | push {(move.p1 - move.p0).length:.1f} m | tumble {spin} deg/frame', flush=True)
    print(f'S06 peak turn {peak:.2f} deg/frame on f{peak_f} ({peak / vfov * 100:.1f}% of the vertical FOV, '
          f'{peak * 1600 / hfov:.0f} px/frame at 1600, shutter {SHUTTER[1]})', flush=True)
    for f in (START, 533, 535, 537, 541, 545, 549, LAND, 559, BOUNCE, 570, 574, SETTLE, 580, 584, 588, 592, 596,
              MOVE1, END):
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        ob = hp.evaluated_get(dg)
        pts = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
        xs, ys = zip(*[project(cam, p)[:2] for p in pts])
        sx, sy, _sz = project(cam, E.SLOT_C)
        print(f'S06 f{f} padlock x {min(xs):.2f}..{max(xs):.2f} y {min(ys):.2f}..{max(ys):.2f} z {hp.location.z:.2f} '
              f'| slot {sx:.3f},{sy:.3f} | pitch {math.degrees(move.state(f)[2]):.1f} turn {move.turn_deg(f):.2f} '
              f'push {move.push(f):.2f} shutter {sc.render.motion_blur_shutter:.2f} seed {sc.cycles.seed}', flush=True)


# ================================================================== build

def build(args):
    sc = C.new_scene(START, END, args.quality, samples=args.samples, threads=args.threads)
    move = Move()
    h = E.build_offline('day', include=PARTS, frames=(START, END), sea_focus=move.sea_focus,
                        floes_near=move.path_xy(), fill=FILL)
    E.tune_render(sc, args.quality, args.samples)
    hp = h['objects']['hero_padlock']
    move.solve(hp.location + hp.rotation_quaternion.to_matrix() @ _hero_centre_local(hp))   # built at its rest pose
    cam = build_camera(move)
    sc.camera = cam
    E.animate_hero_padlock(h, START, LAND, BOUNCE, SETTLE, impact_speed=IMPACT)
    gp = ground_path(h)
    clear_slide_path(h, gp)
    spin, axis, discs = plan_flashes(h, cam)
    rekey_ground(h, gp)
    build_glints(h, discs)
    steel_shackle(h)
    E.apply_fills(h, None)
    E.apply_values(h, {'wall': {'WallBounce': WALL_BOUNCE[0]}})
    E.apply_light_levels(h, None)
    soften_puddles(h)
    glow_dust(h)
    retime_dust(h)
    lichen(h)
    flare_slot(h)
    rim_pines(h, move)
    key_bounce(h, move)
    E.set_shaft_camera(h, False)        # from under the arch the beam's head glowed as a pale tab on the slot-sun
    E.apply_look('day', **LOOK)
    key_shutter(sc, move)
    key_seed(sc, move)
    report(h, cam, move, spin)
    sc.frame_set(START)
    return dict(h=h, cam=cam, move=move, spin=spin, axis=axis, discs=discs)


if __name__ == '__main__':
    a = C.shot_args()
    build(a)
    C.render(SHOT, a, START, END)
