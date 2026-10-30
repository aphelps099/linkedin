"""S10 · f929-992 · the jack (E3_MACRO_INSERTS: socket and jack, inside the Long Room).

    blender -b --factory-startup -P shots/s10_jack.py -- --quality proof --only 929,937,939,941,945,953,961,963,964,982,983,992
    blender -b --factory-startup -P shots/s10_jack.py -- --quality animatic --step 8
    blender -b --factory-startup -P shots/s10_jack.py -- --quality final

Macro of the brass socket in the walnut's head edge and the gold jack in it, 100 mm f/5.6, a
high three-quarter from his left of the socket (CAM). It starts from env_room's approved
's10_jack_macro' set-up (insert kit, hidden far walls, focus on the knurl) but swings the lens
round from his hip, where his own reaching arm filled it, to 64 deg / 16 deg up, 0.56 m: the
socket and the knurl at the centre, the coil arching up out of the frame toward the hub, the
cobalt carpet as the dark ground and the colleagues' colours as soft discs in it
(Room.front_bokeh, re-laid for a lens that looks away from him: place_bokeh). Locked off; a
slow focus breathe as the fingers enter, a late follow-focus onto the jack after the pull.
Real time, motion blur on the pull.

    f929       the jack seated: the first still (the hand is above the frame)
    f930-934   his ivory left hand comes straight down into the top of the frame, fingers open,
               to the knurl's height 4 cm to the hub side of it
    f934-938   it moves across onto the knurl, under the cord's arch (ready_offset: the search
               for an approach on which nothing touches the jack, the socket or the cord)
    f936-938   the index hooks under the barrel as the hand arrives              (servo f937)
    f938-940   the middle finger closes                                           (servo f939)
    f940-942   the thumb comes down onto the knurl                                (servo f941)
    f944-945   grip: the pads bite                                                (click f945)
    f945-960   held; f952-953 the middle finger's knuckle hub flexes 1 degree (resolve)
    f961-963   the pull, hand and jack as one: axial first (the 15 mm pin is out of the bore on
               f962), then up and back, 2.9 cm in all; a glint runs down the barrel (glint);
               the hub's LEDs die on f961 with the music
    f964-982   the yellow coil springs and relaxes (MasterCord.pulled from f961)
    f963-992   the hand holds still; the jack, balanced on the hooked index under the thumb,
               rocks about the pinch for two damped cycles and settles, tail lifted by the coil (SWING);
               f983-992 silence, the jack dangling at rest

Canon: left hand only; the cup stays at his chest in the right hand (the 6 degree lean from the
waist that the reach needs is keyed with rig.lean(keep_cup=True) every frame); no head dip; he
never walks. No text anywhere.

The grip (solve_grip) is searched on the rig round the room's own master cord (env_room's run,
untouched): thumb on the knurl from above and behind, index hooked under it from the lens side,
fingers pointing down, the shoulder protracted; every frame is checked for contact between the
hand and the jack, the socket and the cord (S10_DEBUG=1 prints the report: none).

S11 hand-over (f992): he leans 6 degrees from the waist, left hand pinching the jack 2.4 cm out
from the socket and 1.7 cm up (left_hand() keys it all; S11 can import this module and call it).
"""

import json
import math
import os
import sys
import time

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

SHOT = 's10'
INFO = next(s for s in json.load(open(os.path.join(HERE, 'shots.json'))) if s['id'] == SHOT)
START, END = INFO['start'], INFO['end']
DEBUG = bool(os.environ.get('S10_DEBUG'))

# ------------------------------------------------------------------ the beats (film frames)
F_PREROLL = 921          # S09's end: index on the walnut at the padlock (reach_L), upright
F_LEAN = 931             # the 6 degree lean is in by here (cup kept in place)
F_DESC0 = 925            # the hand starts down from above the frame (pre-roll)
F_LAND = 936             # the open hand arrives at the barrel
F_READY = 934            # the open hand is down at the knurl's height, beside it
F_INDEX, F_MIDDLE, F_THUMB = 937, 939, 941    # each finger's servo; its close straddles the frame
F_GRIP = 945             # the pads bite the knurl
F_KNUCKLE = 953          # one knuckle hub flexes 1 degree
F_PULL = 961             # downbeat: the jack leaves the socket in 3 frames, the music dies
F_OUT = 963              # the pull is done: the hand holds still from here
F_SPRING_END = 982
LEAN_DEG = float(os.environ.get('S10_LEAN', '6.0'))

# the pull path of the jack (offsets from its seat, world): axial first so the 15 mm pin
# clears the bore (out of the bushing on f962), then up and back: 2.9 cm in all
PULL = {F_PULL - 1: (0.0, 0.0), F_PULL: (0.010, 0.0), F_PULL + 1: (0.018, 0.006), F_OUT: (0.024, 0.017)}

# grip geometry: a claw from above (the thumb pad on top of the knurl, the index hooked under
# it, the other three tucked), so the gold reads between the fingers from the lens
PINCH_ALONG = 0.016      # pinch point along the jack axis from its shoulder (knurl spans 2.0-22.5 mm)
GAP = 0.0099             # air between the pads = the knurl's outer diameter (the pads touch it)
GAP_OPEN = 0.036         # thumb opened while the hand comes down
PINCH_INDEX = tuple(float(x) for x in os.environ.get('S10_INDEX', '18,44,30').split(','))
GRIP_FINGERS = dict(index=PINCH_INDEX, middle=(70.0, 92.0, 60.0), ring=(80.0, 95.0, 60.0),
                    pinky=(84.0, 95.0, 58.0))
OPEN_FINGERS = dict(index=(10.0, 26.0, 18.0), middle=(46.0, 66.0, 44.0), ring=(54.0, 70.0, 46.0),
                    pinky=(52.0, 64.0, 42.0))
DESC_H = 0.20            # pinch point this far above the barrel at F_DESC0
GRIP_TH = float(os.environ['S10_TH']) if os.environ.get('S10_TH') else None     # pin the pinch axis's angle round the jack (debug)
REACH_MAX = float(os.environ.get('S10_REACH_MAX', '0.012'))
SHOULDERS = ((30, 0, 0), (36, -4, 0), (40, -4, 0), (40, 4, 0), (24, -6, 0), (16, 0, 0), (46, -4, 0), (50, -6, 0))
# preferred direction of the pinch axis (index pad -> thumb pad), world; None = free
AXIS_PREF = tuple(float(x) for x in os.environ['S10_AXIS_PREF'].split(',')) if os.environ.get('S10_AXIS_PREF') else None

# the jack's rock in the pinch after the pull (degrees; + = tail up, pin down)
SWING = dict(rest=float(os.environ.get('S10_SWING_REST', '10')), amp=float(os.environ.get('S10_SWING_AMP', '14')),
             period=13.0, decay=2.0, tau=4.0)
# the jack balances on the index hooked under the knurl, the thumb resting on top: it rocks about
# the axis square to it through the pinch, and settles with its tail lifted by the coil's pull
# up toward the head edge (the pin dips)
SWING_AXIS = os.environ.get('S10_SWING_AXIS', 'side')


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
    # the hub's LEDs die with the music on the pull; the master cord springs
    room.hub.leds_off(F_PULL)
    return room


# The master cord keeps env_room's run (out of the jack's tail, up and back over the head edge
# straight above it): the grip is searched round it (cord_obstacles). CORD_MIDS can re-lay the
# overhang mids for this insert ({key: (x, y, dz over the walnut or None)}, world).
CORD_MIDS = {}


def route_master_cord(room):
    tz = R.TABLE_TOP + R.MASTER_RC
    for key, (x, y, dz) in CORD_MIDS.items():
        e = room.master.e[key]
        e.location = (x, y, tz if dz is None else tz + dz)
    bpy.context.view_layer.update()


def glint(room, cam):
    """The pull's glint: a tiny hot card, seen only in the jack's gold and chrome (glossy rays,
    light-linked to the jack), riding with the jack on the lens side of the barrel and running
    from the tail to the tip over f961-963, so one bright point travels down the knurl as the
    jack leaves the socket (motion blur draws it as a streak). Placed for this lens: the
    highlight sits where the barrel mirrors the lens toward the card."""
    jr = room.jack.root
    coll = C.collection('S10_lights')
    lt = C.area_light('s10_glint', (0.0, 0.0, 0.0), None, 0.0, 0.004, 0.004, color=(1.0, 0.95, 0.86), coll=coll)
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
    for f, y, e in ((F_PULL - 1, 0.030, 0.0), (F_PULL, 0.024, 0.04), (F_PULL + 1, 0.012, 0.04), (F_OUT, 0.0, 0.02),
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
    """Angle of the jack about the pinch axis after the pull (+ = pin up)."""
    if f <= F_OUT:
        return 0.0
    t = f - F_OUT
    sw = SWING
    w = 2.0 * math.pi / sw['period']
    lam = sw['decay'] / (2.0 * sw['period'])
    settle = sw['rest'] * (1.0 - math.exp(-t / sw['tau']))
    return settle - sw['amp'] * math.exp(-lam * t) * math.sin(w * t)


def key_jack(room, M0, pivot_local, axis_local):
    """Key the jack root every frame: seated, pulled with the hand, then pivoting between the
    pads (pivot and axis in the jack's local space, fixed in the hand once it holds still)."""
    jr = room.jack.root
    jr.rotation_mode = 'QUATERNION'
    M_out = pull_matrix(M0, F_OUT)
    piv_w = M_out @ pivot_local
    ax_w = (M_out.to_3x3() @ axis_local).normalized()
    for f in range(START - 2, END + 3):
        if f <= F_OUT:
            Mw = pull_matrix(M0, f)
        else:
            Rr = Matrix.Rotation(math.radians(swing_deg(f)), 4, ax_w)
            Mw = Matrix.Translation(piv_w) @ Rr @ Matrix.Translation(-piv_w) @ M_out
        jr.matrix_world = Mw
        jr.keyframe_insert('location', frame=f)
        jr.keyframe_insert('rotation_quaternion', frame=f)
    for fc in C.fcurves(jr.animation_data.action):
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'


# ------------------------------------------------------------------ the hand on the jack

def _box_sdf(q, lo, hi):
    d = [max(lo[i] - q[i], q[i] - hi[i]) for i in range(3)]
    outside = Vector([max(x, 0.0) for x in d]).length
    return outside + min(max(d), 0.0)


def _seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / max(ab.dot(ab), 1e-12)))
    return (p - (a + ab * t)).length


def index_pad_normal(rig):
    """Index pad -> thumb pad direction (hand-rest space) for the grip's index angles."""
    hd = rig.hands['L']
    fd = hd['fingers']['index']
    hinge = fd['dir'].cross(hd['w']).normalized()
    acc = sum(PINCH_INDEX)
    return (Matrix.Rotation(math.radians(acc), 3, hinge) @ hd['w']).normalized()


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


def solve_grip(rig, room, cam, frame, M0, jax):
    """The left hand pinching the knurl from above with its fingertips. The hand starts from his
    natural hanging orientation (fingers down, palm toward his body, the index nearest the
    socket face) and is searched over its forward and sideways tilt and its turn about the
    fingers, with elbow poles and shoulder offsets (the reach needs the shoulder protracted),
    for the pose that reaches the knurl, clears his body, the walnut's head edge, the socket and
    the cord, puts the pinch axis square to the jack and leaves the most of the gold, the socket
    and the cord in view of the lens. Coarse grid, then a fine one round the best."""
    t0 = time.time()
    Dc = rig._chest_delta(frame)
    Dw = Dc.inverted()
    R3, Rw = Dc.to_3x3(), Dw.to_3x3()
    o = M0.translation
    pinch_w = o + jax * PINCH_ALONG
    tgt = Dc @ pinch_w
    pin = thumb_rots(rig, GAP)
    hd = rig.hands['L']
    W0 = rig.arm.data.bones['hand_L'].head_local
    fingers = rig.finger_angles('L', GRIP_FINGERS)
    a_h = index_pad_normal(rig)
    jack_a, jack_b = o - jax * 0.015, o + jax * 0.05
    table_lo, table_hi = (-0.8, -30.0, R.ROOM['table_bottom_z']), (0.8, 0.0, R.TABLE_TOP)
    up = Vector((0.0, 0.0, 1.0))
    cam_p = cam.matrix_world.translation.copy()
    # the master cord's run near the jack, as spheres the hand must keep clear of (coil radius
    # 5.5 mm + 2.5 mm air), in chest space
    cord = [(Dc @ q, R.CORD_RC + 0.0025)
            for q in cord_obstacles(room, keep=lambda q: q.y > -0.03 and q.z < 0.86)]
    sock = Vector(R.SOCKET_POS)
    looks = [o + jax * a + up * z for a, z in ((0.004, 0.0045), (0.010, 0.005), (0.024, 0.0042), (0.036, 0.0032),
                                               (0.045, 0.0))]
    looks += [sock + Vector((0.0, 0.003, 0.0105)), sock + Vector((0.009, 0.003, 0.006)),
              sock + Vector((-0.009, 0.003, 0.006))]

    def frame_for(th, ps):
        """Hand frame (chest space) whose pinch axis is square to the jack at angle th round it
        (0 = toward his left, +X; 90 = up) and turned ps about that axis."""
        a_w = (Matrix.Rotation(math.radians(th), 3, jax) @ Vector((1.0, 0.0, 0.0))).normalized()
        a_c = (R3 @ a_w).normalized()
        Rt = Matrix.Rotation(math.radians(ps), 3, a_c) @ a_h.rotation_difference(a_c).to_matrix()
        return Rt @ hd['u'], Rt @ hd['w'], a_w

    def score(th, ps, sh, pole):
        hu, hw, ax_w = frame_for(th, ps)
        Rt = S.frame3(hu, hw) @ S.frame3(hd['u'], hd['w']).transposed()
        wrist = tgt - Rt @ (pin['point'] - W0)
        Rsh, Ru, Rf, Rh = rig._arm_solution('L', wrist, hu, hw, Vector(pole), sh)
        chain = rig._arm_chain('L', Rsh, Ru, Rf, Rh)
        reach = (chain[3] @ W0 - wrist).length
        if reach > REACH_MAX:
            return None
        Dp = rig._pauldron_delta('L', chain, Ru)
        smp = rig._arm_samples('L', chain, fingers, thumb=pin['rot'])
        pen = rig._penetration(smp, None, side='L', Dsh=Dp, obstacles=cord)
        tab = jk = sight = 0.0
        for p, r, part in smp:
            if part in ('hub', 'upper'):
                continue
            q = Dw @ p
            d = _box_sdf(q, table_lo, table_hi) - r
            if d < 0.003:
                tab += (0.003 - d) ** 2 * 4e4
            if part in ('palm', 'wrist', 'fore') or (part == 'finger' and (q - pinch_w).length > 0.03):
                dj = _seg_dist(q, jack_a, jack_b) - r - 0.0055
                if dj < 0.002:
                    jk += (0.002 - dj) ** 2 * 4e4
            for lk in looks:
                ds = _seg_dist(q, cam_p, lk) - r
                if ds < 0.003:
                    sight += min(1.0, (0.003 - ds) / 0.006)
        huw = (Rw @ hu).normalized()
        down = 1.0 + huw.z
        pref = 0.0 if AXIS_PREF is None else 1.0 - ax_w.dot(Vector(AXIS_PREF).normalized())
        total = (pen * 1e4 + reach * 50 + tab + jk + down * 0.3 + sight * 0.25 + pref * 1.5 +
                 0.002 * abs(sh[0]))
        return dict(score=total, wrist=wrist, u=hu, w=hw, pole=Vector(pole), shoulder=tuple(sh), pen=pen, reach=reach,
                    table=tab, jack=jk, perp=0.0, sight=sight, rot=(th, ps), down=down, pref=pref)
    poles = ((0.8, 0.3, -0.5), (0.95, 0.25, 0.0), (0.6, 0.6, -0.5))
    shoulders = SHOULDERS
    best = None
    th_range = range(0, 360, 20) if GRIP_TH is None else [int(GRIP_TH)]
    for th in th_range:
        for ps in range(0, 360, 20):
            for sh in shoulders:
                for pole in poles:
                    s_ = score(th, ps, sh, pole)
                    if s_ is not None and (best is None or s_['score'] < best['score']):
                        best = s_
    if DEBUG:
        for th in range(0, 360, 30):
            cands = [score(th, ps, sh, pole) for ps in range(0, 360, 20) for sh in shoulders for pole in poles]
            cands = [c for c in cands if c is not None]
            if cands:
                c = min(cands, key=lambda c: c['score'])
                print(f'S10 GRIP th={th:3d} best ps={c["rot"][1]:3d} score={c["score"]:.3f} reach={c["reach"]*1000:.1f} '
                      f'pen={c["pen"]*1e4:.3f} table={c["table"]:.3f} jack={c["jack"]:.3f} sight={c["sight"]:.2f} '
                      f'down={c["down"]:.2f} u_w={tuple(round(x, 2) for x in (Rw @ c["u"]))}', flush=True)
            else:
                print(f'S10 GRIP th={th:3d} none reachable', flush=True)
    th0, ps0 = best['rot']
    for th in range(th0 - 12, th0 + 13, 4):
        for ps in range(ps0 - 12, ps0 + 13, 4):
            for sh in {best['shoulder'], (best['shoulder'][0] - 4, best['shoulder'][1], 0),
                       (best['shoulder'][0] + 4, best['shoulder'][1], 0)}:
                s_ = score(th, ps, sh, tuple(best['pole']))
                if s_ is not None and s_['score'] < best['score']:
                    best = s_
    sol = best
    sol['pinch_w'] = pinch_w
    sol['pin'] = pin
    sol['pinch_axis_w'] = (Rw @ (frame3_axis(sol, hd, a_h))).normalized()
    if DEBUG:
        print(f'S10 GRIP solve {time.time() - t0:.1f}s score={sol["score"]:.4f} pen={sol["pen"] * 1e4:.4f} '
              f'reach={sol["reach"] * 1000:.2f}mm table={sol["table"]:.3f} jack={sol["jack"]:.3f} '
              f'perp={sol["perp"]:.3f} sight={sol["sight"]:.2f} rot={sol["rot"]} '
              f'u_w={tuple(round(x, 2) for x in (Rw @ sol["u"]))} '
              f'pinch_axis_w={tuple(round(x, 2) for x in sol["pinch_axis_w"])} pole={tuple(round(x, 2) for x in sol["pole"])} '
              f'shoulder={sol["shoulder"]}', flush=True)
    return sol


def frame3_axis(sol, hd, a_h):
    Rt = S.frame3(sol['u'], sol['w']) @ S.frame3(hd['u'], hd['w']).transposed()
    return Rt @ a_h


def place_hand(rig, frame, sol, pinch_world, interp='LINEAR'):
    """Key the left arm so the pinch point lands on `pinch_world` with the solved hand
    orientation, elbow pole and shoulder (only the arm re-solved: the hand never wobbles)."""
    hd = rig.hands['L']
    W0 = rig.arm.data.bones['hand_L'].head_local
    Rt = S.frame3(sol['u'], sol['w']) @ S.frame3(hd['u'], hd['w']).transposed()
    off = Rt @ (sol['pin']['point'] - W0)
    Dc = rig._chest_delta(frame)
    rig.place_arm(frame, 'L', Dc @ pinch_world - off, sol['u'], sol['w'], sol['pole'], interp,
                  shoulder=sol['shoulder'])


def _bvh(objs, dg):
    from mathutils.bvhtree import BVHTree
    vs, ps = [], []
    for o in objs:
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        k = len(vs)
        vs += [ev.matrix_world @ v.co for v in me.vertices]
        ps += [tuple(i + k for i in p.vertices) for p in me.polygons]
        ev.to_mesh_clear()
    return BVHTree.FromPolygons(vs, ps)


HAND_BONES = ['hand_L'] + [f'{n}_{i}_L' for n in ('index', 'middle', 'ring', 'pinky') for i in (1, 2, 3)] + \
    [f'thumb_{i}_L' for i in range(3)]


def hand_overlaps(rig, room, frame, cord=False):
    """Triangle pairs where his left hand meets the jack and the socket (and, as a second
    number, the master cord)."""
    sc = bpy.context.scene
    sc.frame_set(frame)
    dg = bpy.context.evaluated_depsgraph_get()
    hand = _bvh([o for o in rig.parts_on_bones(HAND_BONES) if o.type == 'MESH'], dg)
    hard = [o for o in room.jack.root.children_recursive if o.type == 'MESH'] + \
        [o for o in room.socket.children_recursive if o.type == 'MESH']
    n = len(hand.overlap(_bvh(hard, dg)))
    if cord:
        return n, len(hand.overlap(_bvh([room.master.obj], dg)))
    return n


def ready_offset(rig, room, sol, pinch_w, jax, approach):
    """Where the open hand stops beside the knurl before the fingers close: the smallest
    offset (square to the jack, toward one side of the pinch) for which the whole descent with
    the fingers open, and the settle onto the pinch as the index closes, touch neither the jack
    nor the socket. `approach(offset)` keys the descent and the settle."""
    ax = sol['pinch_axis_w']
    side = jax.cross(ax).normalized()
    best = None
    checks = list(range(F_INDEX + 1, START - 1, -1))
    lat = Vector((-1.0, 0.0, 0.0))
    dirs = [lat, (lat + Vector((0.0, 0.0, 0.5))).normalized(), (lat - Vector((0.0, 0.0, 0.5))).normalized(),
            side, -side, ax, -ax]
    for mag in (0.0, 0.010, 0.020, 0.030, 0.040, 0.050, 0.060):
        for d in dirs:
            off = d * mag
            approach(off)
            n = 0
            for f in checks:
                n += sum(hand_overlaps(rig, room, f, cord=True))
                if n:
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
        best = Vector((-0.05, 0.0, 0.0))
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


def left_hand(rig, room, cam, M0, jax):
    """The whole left-hand performance (S10, and S11's start state). Returns the grip solution."""
    sc = bpy.context.scene
    sp = Vector(R.SYNERGY_POS)
    k = 'BEZIER'
    # S09's end: the canon idle (cup at the chest, head level with the canon roll), the left
    # index on the walnut at the padlock; then the lean comes in, keyed every frame with the
    # cup re-held exactly where it was (each frame starts from the previous one's pose)
    rig.apply_preset(F_PREROLL, 'idle_cup', k)
    rig.pose(F_PREROLL, k, root_loc=tuple(sp), root_rot=0.0)
    rig.reach_L(F_PREROLL, interp=k)
    for f in range(F_DESC0, F_LEAN + 1):
        t = (f - F_DESC0) / float(F_LEAN - F_DESC0)
        rig.lean(f, LEAN_DEG * ease(t), 'LINEAR', keep_cup=True)
    sol = solve_grip(rig, room, cam, F_GRIP, M0, jax)
    pinch_w = sol['pinch_w']
    up = Vector((0.0, 0.0, 1.0))
    for nm, ang in OPEN_FINGERS.items():
        key_fingers(rig, F_DESC0, nm, ang, 'LINEAR')
        key_fingers(rig, F_LAND, nm, ang, 'BEZIER')
    key_thumb(rig, F_DESC0, GAP_OPEN, 'LINEAR')
    for f in range(F_INDEX + 1, F_PULL):
        place_hand(rig, f, sol, pinch_w, 'LINEAR')

    def approach(ready):
        # straight down from above the frame to the ready point beside the knurl (eased in and
        # out, fingers open), then across onto it (under the cord's arch) as the index closes
        for f in range(F_DESC0, F_READY + 1):
            t = (f - F_DESC0) / float(F_READY - F_DESC0)
            place_hand(rig, f, sol, pinch_w + ready + up * (DESC_H * (1.0 - ease(t))), 'LINEAR')
        for f in range(F_READY + 1, F_INDEX + 1):
            t = (f - F_READY) / float(F_INDEX + 1 - F_READY)
            place_hand(rig, f, sol, pinch_w + ready * (1.0 - ease(t)), 'LINEAR')
    ready = ready_offset(rig, room, sol, pinch_w, jax, approach)
    # one finger at a time: index, middle, thumb (each close straddles its servo frame)
    key_fingers(rig, F_INDEX - 1, 'index', OPEN_FINGERS['index'])
    key_fingers(rig, F_INDEX + 1, 'index', GRIP_FINGERS['index'])
    key_fingers(rig, F_MIDDLE - 1, 'middle', OPEN_FINGERS['middle'])
    key_fingers(rig, F_MIDDLE + 1, 'middle', GRIP_FINGERS['middle'])
    for nm in ('ring', 'pinky'):
        key_fingers(rig, F_MIDDLE - 1, nm, OPEN_FINGERS[nm])
        key_fingers(rig, F_MIDDLE + 2, nm, GRIP_FINGERS[nm])
    key_thumb(rig, F_THUMB - 1, GAP_OPEN, k)
    key_thumb(rig, F_THUMB + 1, GAP + 0.0008, k)
    key_thumb(rig, F_GRIP - 1, GAP + 0.0008, k)
    key_thumb(rig, F_GRIP, GAP, k)
    # resolve: one knuckle hub (the middle finger's) flexes 1 degree
    mid = GRIP_FINGERS['middle']
    key_fingers(rig, F_KNUCKLE - 1, 'middle', mid, k)
    key_fingers(rig, F_KNUCKLE, 'middle', (mid[0] + 1.0, mid[1], mid[2]), k)
    # the pull: the hand and the jack as one, then the hand holds still
    pinch_local = M0.inverted() @ pinch_w
    for f in range(F_PULL - 1, END + 3):
        place_hand(rig, f, sol, pull_matrix(M0, min(f, F_OUT)) @ pinch_local, 'LINEAR')
    rig.bake_pauldrons(F_PREROLL, END + 2)
    # the axis the jack rocks about in the pinch after the pull (key_jack): square to the jack
    # through the pinch ('side'), or the pinch axis itself ('pinch')
    sol['axis_w'] = sol['pinch_axis_w'] if SWING_AXIS == 'pinch' else jax.cross(Vector((0.0, 0.0, 1.0))).normalized()
    sc.frame_set(START)
    return sol


# ------------------------------------------------------------------ camera

# the lens: env_room's approved 's10_jack_macro' setup (kits, hidden far walls, focus on the
# knurl), moved round to a high three-quarter on his left of the socket (the treatment's
# framing): from the approved spot, between the table and his hip, his own reaching arm
# fills the lens. azimuth from +Y (him) toward +X, elevation, distance to the aim point
CAM = dict(az=64.0, el=16.0, dist=0.56, lens=100.0, fstop=5.6, aim=(0.0, 0.016, 0.010))
for _k in ('az', 'el', 'dist', 'fstop'):
    if os.environ.get(f'S10_CAM_{_k.upper()}'):
        CAM[_k] = float(os.environ[f'S10_CAM_{_k.upper()}'])


def build_camera(room):
    f0, cam = R.preview_camera(room, 's10_jack_macro')
    foc = cam.data.dof.focus_object
    bpy.context.view_layer.update()
    o = room.jack.root.matrix_world.translation.copy()
    aim = o + Vector(CAM['aim'])
    a, e = math.radians(CAM['az']), math.radians(CAM['el'])
    d = Vector((math.sin(a) * math.cos(e), math.cos(a) * math.cos(e), math.sin(e)))
    cam.location = aim + d * CAM['dist']
    C.look_at(cam, aim)
    cam.data.lens = CAM['lens']
    cam.data.shift_x = cam.data.shift_y = 0.0
    cam.data.dof.aperture_fstop = CAM['fstop']
    bpy.context.view_layer.update()
    return cam, foc


def key_focus(cam, foc, M0, jax, sol):
    """Slow focus breathe as the fingers enter (the plane drifts 5 mm toward the lens and back),
    then after the pull a late follow-focus onto the dangling jack."""
    rest = foc.location.copy()
    cam_p = cam.matrix_world.translation
    toward = (cam_p - rest).normalized()
    pinch_local = M0.inverted() @ sol['pinch_w']
    after = pull_matrix(M0, F_OUT) @ pinch_local
    # the focus distance of the pinch point after the pull (measured along the lens axis)
    fwd = (cam.matrix_world.to_3x3() @ Vector((0.0, 0.0, -1.0))).normalized()
    d_rest = (rest - cam_p).dot(fwd)
    d_after = (after - cam_p).dot(fwd)
    keys = [(START, 0.0), (933, 0.0035), (938, 0.0050), (946, 0.0), (F_PULL + 2, 0.0), (F_PULL + 9, d_rest - d_after)]
    for f, d in keys:
        foc.location = rest + (toward * d if f <= F_PULL else fwd * -d)
        foc.keyframe_insert('location', frame=f)


# ------------------------------------------------------------------ the colour glow behind

# Room.front_bokeh lays its discs round his head for a lens that faces him; this lens looks
# away from him, down at the socket, so the discs are re-laid where the frame looks past the
# head edge into the dark (over the carpet), each the size a distant screen's glow takes at
# 100 mm f/5.6 focused at half a metre: (image x, image y, size as a fraction of the width)
BOKEH = {'kevin': (0.80, 0.82, 0.115), 'people': (0.95, 0.47, 0.085), 'strategy': (0.70, 0.62, 0.07),
         'operations': (0.98, 0.92, 0.10)}
BOKEH_DIST = 3.0


def place_bokeh(room, cam):
    """Re-lay the front_bokeh discs (their material and screen-state drivers kept) on the
    rays through BOKEH's image points, short of whatever those rays hit (the carpet); discs
    not in BOKEH are hidden."""
    sc = bpy.context.scene
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    mw = cam.matrix_world
    loc, rot = mw.translation.copy(), mw.to_3x3()
    cd = cam.data
    res_x = sc.render.resolution_x * sc.render.resolution_percentage / 100.0
    res_y = sc.render.resolution_y * sc.render.resolution_percentage / 100.0
    sw, lens = cd.sensor_width, cd.lens
    sh = sw * res_y / res_x
    f_px = lens / sw * res_x
    F = (cd.dof.focus_object.matrix_world.translation - loc).length if cd.dof.focus_object else cd.dof.focus_distance
    fs = cd.dof.aperture_fstop
    def ray(x, y):
        dirc = Vector(((x - 0.5) * sw / lens, (y - 0.5) * sh / lens, -1.0))
        dw = (rot @ dirc).normalized()
        hit, hp, *_ = sc.ray_cast(dg, loc, dw, distance=50.0)
        return dw, ((hp - loc).length if hit else 50.0)
    discs = list(getattr(room, 'bokeh', []))
    for o in discs:
        o.hide_render = True
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    for o in discs:
        nm = o.get('bokeh_terminal')
        if nm not in BOKEH:
            continue
        x0, y0, size = BOKEH[nm]
        # the nearest image point to the preferred one whose ray runs at least 1.6 m clear
        best = None
        for dx in (0.0, -0.03, 0.03, -0.06, 0.06, -0.1, 0.1):
            for dy in (0.0, -0.04, 0.04, -0.08, 0.08, -0.12, 0.12):
                x, y = min(0.99, max(0.01, x0 + dx)), min(0.99, max(0.01, y0 + dy))
                dw, hd = ray(x, y)
                if hd >= 1.6 and (best is None or dx * dx + dy * dy < best[0]):
                    best = (dx * dx + dy * dy, dw, hd, x, y)
        if best is None:
            continue
        _, dw, hd, x, y = best
        o.hide_render = False
        D = min(BOKEH_DIST, hd - 0.08)
        fl = lens / 1000.0
        blur = (fl * fl / (fs * max(F - fl, 1e-3))) * abs(D - F) / D / (sw / 1000.0) * res_x
        target = size * res_x
        g_px = max(target - 0.8 * blur, 0.35 * target)
        diam = g_px / f_px * D
        r0 = max(v.co.length for v in o.data.vertices)
        o.scale = (diam / (2.0 * r0),) * 3
        o.location = loc + dw * D
        o.rotation_euler = (-dw).to_track_quat('Z', 'Y').to_euler()
        if DEBUG:
            print(f'S10 BOKEH {nm}: at ({x:.2f}, {y:.2f}) {D:.2f} m, blur {blur:.0f}px, disc {g_px:.0f}px of '
                  f'{target:.0f}px', flush=True)


# ------------------------------------------------------------------ build

def build(args):
    t0 = time.time()
    C.new_scene(START, END, args.quality, samples=args.samples, threads=args.threads)
    M.set_quality(args.quality)
    room = build_room()
    # the kit's dust motes bake a point cache: kept beside this shot's frames, so parallel shot
    # renders never write the same cache file at once
    room.insert_lights('jack', cache_dir=os.path.join(os.path.abspath(args.out), '_cache'))
    cam, foc = build_camera(room)
    room.use_kits('jack')
    M0, jax = jack_seat(room)

    # Synergy: face idle (unseen here), the left hand performs
    tl = F.FaceTimeline(START, END)
    rig = S.build(timeline=tl, location=R.SYNERGY_POS)
    t1 = time.time()
    sol = left_hand(rig, room, cam, M0, jax)
    t2 = time.time()

    # the jack follows the pinch: seated, pulled, then pivoting between the pads
    pinch_local = M0.inverted() @ sol['pinch_w']
    axis_local = (M0.to_3x3().inverted() @ sol['axis_w']).normalized()
    key_jack(room, M0, pinch_local, axis_local)
    route_master_cord(room)
    room.master.pulled(F_PULL)
    glint(room, cam)
    key_focus(cam, foc, M0, jax, sol)

    # warm walnut bounce for his lower body (tools/synergy_in_room.bounce_light)
    sp = Vector(R.SYNERGY_POS)
    b = C.area_light('syn_bounce', (sp.x, sp.y - 0.80, R.TABLE_TOP + 0.02), (sp.x, sp.y - 0.05, 1.22),
                     9.0, 1.1, 0.5, color=(1.0, 0.84, 0.70), coll=C.collection('S10_lights'))
    b.visible_camera = False
    b.visible_glossy = False

    # colleagues' colour glow in the bokeh beyond the head edge
    room.front_bokeh(cam, START)
    place_bokeh(room, cam)

    # render look: macro budget, locked-off seed, macro glare threshold, scanlines for this lens
    room.render_budget(kind='macro', samples=args.samples or None, locked=True)
    room.compositor(threshold=1.6)
    room.tune_scanlines(cam)
    bpy.context.scene.camera = cam
    print(f'S10 BUILD room+rig {t1 - t0:.1f}s  performance {t2 - t1:.1f}s  total {time.time() - t0:.1f}s', flush=True)
    if DEBUG:
        report(rig, room, cam, sol)
    return room, rig, cam


def report(rig, room, cam, sol):
    """Contacts that matter on camera, every frame: his hand against the jack, the socket and
    the master cord (triangle pairs), and where the pinch sits in the frame."""
    from bpy_extras.object_utils import world_to_camera_view
    sc = bpy.context.scene
    bad = []
    for f in range(START, END + 1):
        n = hand_overlaps(rig, room, f, cord=True)
        if any(n):
            bad.append((f, n))
    print('S10 REPORT hand contacts (frame, (jack+socket, cord) pairs):', bad or 'none', flush=True)
    if bad:
        from collections import Counter
        f0 = max(bad, key=lambda b: sum(b[1]))[0]
        sc.frame_set(f0)
        dg = bpy.context.evaluated_depsgraph_get()
        hard = [o for o in room.jack.root.children_recursive if o.type == 'MESH'] + \
            [o for o in room.socket.children_recursive if o.type == 'MESH'] + [room.master.obj]
        tb = _bvh(hard, dg)
        hits = Counter()
        for o in rig.parts_on_bones(HAND_BONES):
            if o.type == 'MESH':
                n = len(_bvh([o], dg).overlap(tb))
                if n:
                    hits[o.name] = n
        print(f'S10 REPORT worst frame {f0}: parts {dict(hits)}', flush=True)
    for f in (929, 937, 945, 961, 963, 975, 992):
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        jr = room.jack.root.evaluated_get(dg).matrix_world
        uv = world_to_camera_view(sc, cam, jr @ Vector((0, PINCH_ALONG, 0)))
        print(f'S10 REPORT f{f}: pinch in frame ({uv.x:.2f}, {uv.y:.2f})  swing {swing_deg(f):.1f}', flush=True)


if __name__ == '__main__':
    a = C.shot_args()
    build(a)
    C.render(SHOT, a, START, END)
