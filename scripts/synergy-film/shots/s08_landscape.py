"""S08 · f753-832 · 31.33-34.67 s · E1_OFFLINE (day): everything deferred is landscape.

    blender -b --factory-startup -P shots/s08_landscape.py -- --quality proof --only 753,760,768,769,779,785,790,801,813,817,832
    blender -b --factory-startup -P shots/s08_landscape.py -- --quality animatic --step 8
    blender -b --factory-startup -P shots/s08_landscape.py -- --quality final

Inside the cup, golden afternoon. A 14 mm crane, already moving at the cut, pulls back 60 m
from low over the espresso, rises from 1.8 m to 10 m and tilts down from +31 to +17.5 degrees
(panning 5 degrees left), and eases into the approved env framing 's08_poster' (CAM_S08 on the
wet-stone shelf): the slot-sun in the ribbed vault, the padlock arch in the left third, the
atoll's palms and the island's dark box in the shaft at the horizon, the paper falls right of
centre, the green terraces in the right third, the murmuration pouring across the cliffs above
the arch, and the faceted wet stone of the shelf rising into the lower left as we pull back.
In the foreground the last envelope flutters down the beam, opens into a white paper bird and
flies off toward the head of the murmuration.

Frame by frame (film frames; 90 BPM, a beat every 16 frames, beat b starts at 16b+1):
  f753      beat 47, the cut: the crane is already pulling back and tilting down (1.4 m/frame);
            looking up into the vault, horizon low, the landforms standing on it, the flock
            pouring in from the top left
  f762-768  the envelope (white, cobalt seal) drops into frame from above, autorotating about its
            long edge in front of the beam's right edge, 11-18 m from the lens
  f768-769  beat 48: face-on to the lens, seal showing, ~160 px across at 1600 px (unfold starts)
  f768-790  it opens into an origami bird (the spin dies away, the fall blends into a glide);
            the unfold sound lands on f772, the wings from f776
  f790-832  the bird flaps off up and left toward the murmuration's head (9 -> 30 m/s), shrinking
            to one bird among thousands (~25 px at 1600 px by f832)
  f793-     the shelf rises into the lower left as the crane passes back over it
  f813-832  the last 20 frames settle into the poster (2.6% of the move left at f813; zero speed
            and acceleration on f832); f832 is the 's08_poster' framing exactly
Nothing else is keyed: the falls, the flock, its near strays and the foam are env_offline's
film-time crowds and swell; S06's padlock rests on the scree at the arch's foot.

Deviations from the treatment's camera (composition and timing held): the director approved the
Offline owner's poster at 14 mm from the wet-stone shelf 10 m up (CAM_S08), not 18 mm at 450 m,
so the crane rises and pulls back into that lens (the tilt keeps the treatment's downward
direction). The hero envelope uses env_offline's mesh, materials and envelope-to-bird morph but
the shot's own path (envelope_path): build_hero_envelope drops it at 24 m/s and places it for
the poster lens, which from this moving crane is either a 20 px speck or a half-second blur.
It is light-linked to two lamps of its own (the slot-sun it falls through, and the glowing paper
behind the lens), because the cup's paper lights the world at only 40% of its glow and a white
card in front of the paper would otherwise read as a grey postcard.

Camera: one camera keyed on every frame (no roll), deep focus (no DOF), 14 mm throughout.
Sampling: a new seed every frame while the crane moves (no denoiser residue riding on the screen
while the world slides under it); the Offline fixed seed (0) once it has settled (f830-832).
"""

import json
import math
import os
import sys

import bpy
import numpy as np
from mathutils import Euler, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'lib'))

import cache as PC  # noqa: E402
import common as C  # noqa: E402
import env_offline as E  # noqa: E402

SHOT = 's08'
INFO = next(s for s in json.load(open(os.path.join(HERE, 'shots.json'))) if s['id'] == SHOT)
START, END = INFO['start'], INFO['end']

# ------------------------------------------------------------------ sync points (film frames)
UNFOLD0, UNFOLD1 = 768, 790   # it opens into a bird (beat 48 is f769; the unfold sound lands on f772)
SETTLE = 813            # the last 20 frames settle into the poster (env framing 's08_poster')

# ------------------------------------------------------------------ the crane (ends on 's08_poster')
LENS = 14.0
PULL = 60.0             # m: pulled back along the poster's view azimuth, into the poster lens (CAM_S08)
SIDE0 = 0.0             # m: start offset to the right of that line
Z0 = 1.8                # m above the sea at the cut (CAM_S08 is 10 m up on the shelf)
PITCH0 = 31.0           # deg at the cut (the poster is +17.5): tilts down as it rises
YAW0 = -5.0             # deg at the cut, relative to the poster's yaw (positive = left)
PULL_A = 1.2            # pull, tilt: u = 1 - (1 - t)^3 (1 + a t): already moving at the cut (slope 3 - a), at rest on
RISE_A = 0.0            # f832 with zero speed and acceleration; the rise (a = 0: slope 3) leads the pull a little

# ------------------------------------------------------------------ the envelope (env geometry, the shot's own path)
ENV_FRAME = UNFOLD0     # where it starts to open, seen from the lens on this frame:
ENV_Y = 0.6             # this high in frame (0 bottom, 1 top),
ENV_X_OFF = 0.07        # this far right of the shaft's axis (frame widths),
ENV_DIST = 18.0         # and this far (m) from the lens
V_FALL = 10.0           # m/s: a broad paper card flutters down (env_offline's poster envelope drops at 24)
SWAY = (3.0, 26.0)      # m/s, frames: its side-to-side flutter while it falls
TUMBLE = 330.0          # deg/s: it autorotates about its long edge, slowing to a stop as it opens
V_GLIDE = 9.0           # m/s along its flight line when the wings are open (f790)
V_FLY = 30.0            # m/s by the end of the shot, steering into the flock
STEER = 0.08            # per frame
FLOCK_AIM = (0.40, 0.70)   # it flies to the flock bird nearest this point of the poster frame (f832),
AIM_DIST = 130.0         # or (if > 0) to the point this far (m) from the poster lens on its line of sight to that bird
WINGBEAT = 2.6          # Hz (env_offline's hero bird)
ENV_FACE = (24.0, 12.0)    # deg on ENV_FRAME: turned back about its long edge from face-on, and rolled in its plane
ENV_PUFF = 0.5          # m: its back bulges this much at the centre (env 0.22), so the flap folds catch the light
ENV_SUN = 6.0           # W/m2: the slot-sun the envelope catches as it tumbles down the beam (a sun lamp down the
ENV_SUN_K = 5600.0      # shaft, light-linked to the envelope alone: the real sun only lights inside the prism)
ENV_FILL = 14.0         # W/m2: the glowing paper behind the lens on its near face (the world gets only ~40% of the
ENV_FILL_DIR = (0.0, 35.0)   # paper's glow as bounce); (yaw from behind the lens, elevation) in degrees
ENV_FILL_K = 4800.0

SEED_PX = 0.3           # animated sampling seed while anything 20 m out moves more than this (px/frame at 1600 px)


def ueo(t, a):
    """Ease-out with an initial slope 3 - a and zero speed and acceleration at t = 1."""
    t = min(1.0, max(0.0, t))
    return 1.0 - (1.0 - t) ** 3 * (1.0 + a * t)


class Crane:
    """Camera path: pull back, rise and tilt down into the 's08_poster' framing."""

    def __init__(self):
        fr = E.framing('s08_poster')
        self.fr = fr
        self.p1 = Vector(fr['location'])
        self.yaw1, self.pitch1 = math.radians(E._S08_YAW), math.radians(E._S08_PITCH)
        fwd = Vector((math.cos(self.yaw1), math.sin(self.yaw1), 0.0))
        self.fwd, self.side = fwd, Vector((fwd.y, -fwd.x, 0.0))
        self.p0 = self.p1 + fwd * PULL + self.side * SIDE0
        self.p0.z = Z0
        self.yaw0 = self.yaw1 + math.radians(YAW0)
        self.pitch0 = math.radians(PITCH0)

    def t(self, f):
        return (f - START) / float(END - START)

    def state(self, f):
        t = self.t(f)
        u, w = ueo(t, PULL_A), ueo(t, RISE_A)
        if t < 0:                       # before the cut it was already moving (motion blur on f753)
            u, w = (3.0 - PULL_A) * t, (3.0 - RISE_A) * t
        loc = self.p0.lerp(self.p1, u)
        loc.z = self.p0.z + (self.p1.z - self.p0.z) * w
        yaw = self.yaw0 + (self.yaw1 - self.yaw0) * u
        pitch = self.pitch0 + (self.pitch1 - self.pitch0) * u
        return loc, yaw, pitch

    def euler(self, f):
        _l, yaw, pitch = self.state(f)
        return Euler((math.pi / 2 + pitch, 0.0, yaw - math.pi / 2), 'XYZ')

    def forward(self, f):
        _l, yaw, pitch = self.state(f)
        return Vector((math.cos(yaw) * math.cos(pitch), math.sin(yaw) * math.cos(pitch), math.sin(pitch)))

    def motion_px(self, f, near=20.0, width=1600):
        """Screen motion (px/frame at `width`) of a point `near` m away between f-1 and f."""
        la, ya, pa = self.state(f - 1)
        lb, yb, pb = self.state(f)
        turn = math.hypot((yb - ya) * math.cos(0.5 * (pa + pb)), pb - pa)
        fov = 2 * math.atan(18.0 / LENS)
        return ((lb - la).length / near + turn) * width / fov

    def path_xy(self, n=8):
        return [tuple(self.state(START + (END - START) * i / (n - 1))[0].to_2d()) for i in range(n)]


def build_camera(crane):
    cam = E.camera_offline(LENS, crane.p0, crane.p0 + crane.forward(START), fstop=0.0)
    cam.rotation_mode = 'XYZ'
    for f in range(START - 2, END + 3):
        loc, _y, _p = crane.state(f)
        cam.location = loc
        cam.rotation_euler = crane.euler(f)
        cam.keyframe_insert('location', frame=f)
        cam.keyframe_insert('rotation_euler', frame=f)
    for fc in C.fcurves(cam.animation_data.action):
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'
    return cam


def screen_xy(crane, f, p):
    """(x, y, depth) in frame (0..1, 0 at the bottom left) of world point(s) p seen from the crane on frame f."""
    loc, yaw, _pitch = crane.state(f)
    fwd = np.array(crane.forward(f))
    right = np.array((math.sin(yaw), -math.cos(yaw), 0.0))
    up = np.cross(right, fwd)
    d = np.asarray(p, dtype=float) - np.array(loc)
    z = d @ fwd
    return 0.5 + (d @ right) / z * LENS / 36.0, 0.5 + (d @ up) / z * LENS / (36.0 * 9 / 16), z


def envelope_point(crane):
    """Where the envelope starts to open: ENV_DIST m from the ENV_FRAME lens, on its line of sight to the
    frame point ENV_Y high and ENV_X_OFF right of the shaft's axis (the axis point found by bisection)."""
    loc, yaw, _p = crane.state(ENV_FRAME)
    end = Vector((E.ISLAND_C.x, E.ISLAND_C.y, E._BOX_Z))
    axis = lambda k: E.SLOT_C + (end - E.SLOT_C) * k  # noqa: E731
    lo, hi = 0.0, 1.0                                  # slot (high in frame) -> island (low)
    for _ in range(40):
        k = 0.5 * (lo + hi)
        if screen_xy(crane, ENV_FRAME, axis(k))[1] > ENV_Y:
            lo = k
        else:
            hi = k
    x, y, _z = screen_xy(crane, ENV_FRAME, axis(0.5 * (lo + hi)))
    fwd = crane.forward(ENV_FRAME)
    right = Vector((math.sin(yaw), -math.cos(yaw), 0.0))
    up = right.cross(fwd)
    ray = fwd + right * ((x + ENV_X_OFF - 0.5) * 36.0 / LENS) + up * ((y - 0.5) * 36.0 * 9 / 16 / LENS)
    return loc + ray.normalized() * ENV_DIST


def flock_target(crane, P, f0):
    """Index of the flock bird nearest FLOCK_AIM in the poster frame (f832)."""
    x, y, z = screen_xy(crane, END, P[END - f0])
    d = np.hypot(x - FLOCK_AIM[0], (y - FLOCK_AIM[1]) * 9 / 16) + (z <= 0) * 10.0
    return int(np.argmin(d))


def smooth01(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def envelope_path(crane, P, f0):
    """Per-frame (location, velocity, open fraction, quaternion) of the hero envelope, film frames START-2..END+2.

    f <= UNFOLD0: it flutters straight down at V_FALL (a sideways sway in the lens's horizontal),
    autorotating about its long edge, and on ENV_FRAME it is face-on to the lens, seal showing.
    UNFOLD0-UNFOLD1: it opens into a bird (smoothstep), the spin dies away and its velocity blends from
    the fall into a slow glide toward its flock bird. After: it steers after that bird, speeding up to V_FLY.
    """
    fr = list(range(START - 2, END + 3))
    p_open = envelope_point(crane)
    loc, yaw, _p = crane.state(ENV_FRAME)
    right = Vector((math.sin(yaw), -math.cos(yaw), 0.0))
    w = 2 * math.pi / SWAY[1]

    def fall_vel(f):                                   # m/s
        return Vector((0.0, 0.0, -V_FALL)) + right * (SWAY[0] * math.sin(w * f))

    def fall_pos(f):                                   # integral of fall_vel, = p_open on UNFOLD0
        lat = lambda g: -SWAY[0] / (w * 24.0) * math.cos(w * g)  # noqa: E731
        return p_open + Vector((0.0, 0.0, V_FALL * (UNFOLD0 - f) / 24.0)) + right * (lat(f) - lat(UNFOLD0))

    ti = flock_target(crane, P, f0)
    bird = lambda f: Vector(P[min(max(f, f0), f0 + len(P) - 1) - f0, ti])  # noqa: E731
    if AIM_DIST > 0:
        tgt = lambda f: crane.p1 + (bird(f) - crane.p1).normalized() * AIM_DIST  # noqa: E731
    else:
        tgt = bird
    glide_dir = (tgt(UNFOLD1) - p_open).normalized()
    # face-on to the ENV_FRAME lens: local +z (the seal) at the lens, the long edge (local x) level
    zf = (loc - p_open).normalized()
    yf = zf.cross(right).normalized()
    xf = yf.cross(zf)
    from mathutils import Matrix, Quaternion
    q_face = Matrix((xf, yf, zf)).transposed().to_quaternion() @ Quaternion((0, 0, 1), math.radians(ENV_FACE[1])) \
        @ Quaternion((1, 0, 0), math.radians(-ENV_FACE[0]))
    spin_axis = Vector((1.0, 0.0, 0.18)).normalized()            # local: about the long edge, a little off
    out = {}
    p, v, spun = p_open.copy(), fall_vel(UNFOLD0), 0.0
    for f in range(UNFOLD0, fr[-1] + 1):
        u = smooth01((f - UNFOLD0) / float(UNFOLD1 - UNFOLD0))
        if f > UNFOLD0:
            if f <= UNFOLD1:
                v = fall_vel(f).lerp(glide_dir * V_GLIDE, u)
            else:
                k = smooth01((f - UNFOLD1) / float(END - UNFOLD1))
                want = (tgt(f) - p).normalized() * (V_GLIDE + (V_FLY - V_GLIDE) * k)
                v = v + (want - v) * STEER
            p = p + v / 24.0
            spun += (1.0 - u)
        out[f] = (p.copy(), v.copy(), u, spun)
    for f in fr:
        if f < UNFOLD0:
            out[f] = (fall_pos(f), fall_vel(f), 0.0, float(f - UNFOLD0))
    path = {}
    for f in fr:
        p, v, u, spun = out[f]
        q_tum = q_face @ Quaternion(spin_axis, math.radians(TUMBLE) * spun / 24.0)
        q_fly = v.normalized().to_track_quat('Y', 'Z')
        path[f] = (p, v, u, q_tum.slerp(q_fly, u))
    return path, ti


def build_envelope(h, crane, flock_count):
    """The hero envelope (env_offline's mesh, materials and morph), on this shot's path (envelope_path).

    env_offline's build_hero_envelope drops it at 24 m/s and places it for the poster lens: from this
    crane it is either a speck (140 m out) or, close enough to read, a fall that crosses the frame in
    half a second and an opening lost in blur. Here it flutters down the beam at V_FALL, hangs as it
    opens (ENV_DIST m from the lens), then flies off into the flock. Written to the
    shot's own cache folder (never the poster's envelope cache that other renders may be reading)."""
    f0 = min(E.FLOCK_WINDOW[0], START - 62)
    f1 = max(E.FLOCK_WINDOW[1], END + 3)
    P, _Vv = E.simulate_flock(flock_count, f0, f1, 31, E.CACHE_DIR)       # the cached flock build_offline used
    path, ti = envelope_path(crane, P, f0)
    fr = sorted(path)
    env_shape = E.ENVELOPE.copy()
    env_shape[0, 2] = ENV_PUFF
    seal_z = ENV_PUFF + 0.03                               # on the bulge
    seal = np.array([[-0.35, -0.35, 0], [0.35, -0.35, 0], [0.35, 0.35, 0], [-0.35, 0.35, 0]]) + [0, 0, seal_z]
    pos = np.empty((len(fr), 11, 3), np.float32)
    for i, f in enumerate(fr):
        p, _v, u, q = path[f]
        flap = 0.55 * math.sin(2 * math.pi * WINGBEAT * (f / 24.0)) + 0.12
        shape = (1 - u) * env_shape + u * E.bird_shape(np.array([flap * u]))[0]
        sl = seal.copy()
        sl[:, 2] = (1 - u) * seal_z + u * (-0.3)
        sl = sl * (1 - 0.95 * u) + E.BIRD[0] * 0.95 * u
        R = np.array(q.to_matrix())
        pos[i] = np.concatenate([shape, sl], 0) @ R.T + np.array(p)
    cache = os.path.join(C.ROOT, 'out', 'cache', 's08')
    pc2 = E._write_pc2(os.path.join(cache, f'envelope_{fr[0]}_{fr[-1]}.pc2'), pos, start=fr[0])
    F = np.vstack([E.BIRD_F, [[7, 8, 9], [7, 9, 10]]])
    m0, m1 = E.mat_envelope()
    ob = E.np_mesh('OFF_HeroEnvelope', pos[0], F, coll=C.collection('OFFLINE'), mat=[m0, m1], smooth=False,
                   mat_index=[0] * 6 + [1, 1])
    E.set_attr(ob.data, 'tint', np.zeros(11))
    PC.attach_pc2(ob, pc2, fr[0])
    h['objects']['hero_envelope'] = ob
    print(f'S08 envelope opens at {tuple(round(v, 1) for v in path[UNFOLD0][0])}, flies to flock bird {ti}', flush=True)
    return ob


def envelope_lights(h, env, crane):
    """The envelope is in the beam (on screen): a sun lamp down the shaft lights it, and only it; a soft
    fill from the glowing paper behind the lens lights its near face (also linked to it alone)."""
    rc = bpy.data.collections.new('S08_EnvelopeLink')        # not in the scene: a link set
    rc.objects.link(env)
    _l, yaw, _p = crane.state(ENV_FRAME)
    a, el = yaw + math.pi + math.radians(ENV_FILL_DIR[0]), math.radians(ENV_FILL_DIR[1])
    fill_from = Vector((math.cos(a) * math.cos(el), math.sin(a) * math.cos(el), math.sin(el)))
    out = []
    for name, energy, k, ang, d in (('S08_EnvelopeSun', ENV_SUN, ENV_SUN_K, 0.9, -E.SHAFT_DIR),
                                    ('S08_EnvelopeFill', ENV_FILL, ENV_FILL_K, 40.0, fill_from)):
        L = C.sun_light(name, (0, 0, 0), energy=energy, angle_deg=ang, color=E.kelvin(k), coll=C.collection('OFFLINE'))
        L.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
        L.data.cycles.max_bounces = 1
        L.light_linking.receiver_collection = rc
        L.light_linking.blocker_collection = rc
        L.hide_render = energy <= 0.0
        out.append(L)
    h['lights']['envelope_sun'], h['lights']['envelope_fill'] = out
    return out


def key_seed(sc, crane):
    """Fixed sampling seed once the crane has settled (nothing static boils), a new seed per frame
    while it moves (no denoiser residue riding on the screen while the world slides under it)."""
    cy = sc.cycles
    cy.use_animated_seed = False
    for f in range(START - 2, END + 3):
        moving = f <= END and max(crane.motion_px(f), crane.motion_px(min(f + 1, END))) > SEED_PX
        cy.seed = f if moving else 0
        cy.keyframe_insert('seed', frame=f)
    for fc in C.fcurves(sc.animation_data.action):
        if fc.data_path == 'cycles.seed':
            for kp in fc.keyframe_points:
                kp.interpolation = 'CONSTANT'


def project(cam, p):
    from bpy_extras.object_utils import world_to_camera_view
    v = world_to_camera_view(bpy.context.scene, cam, Vector(p))
    return v.x, v.y, v.z


def report(h, cam, crane):
    """Print the crane and where the envelope sits in frame (and its size at 1600 px)."""
    sc = bpy.context.scene
    env = h['objects'].get('hero_envelope')
    for f in (START, 757, 760, 764, UNFOLD0, 772, 776, 779, 784, UNFOLD1, 796, 801, 808, SETTLE, 822, END):
        sc.frame_set(f)
        loc, yaw, pitch = crane.state(f)
        line = (f'S08 f{f} cam {tuple(round(v, 1) for v in loc)} yaw {math.degrees(yaw):.1f} '
                f'pitch {math.degrees(pitch):.2f} move {crane.motion_px(f):.1f}px seed {sc.cycles.seed}')
        if env is not None:
            dg = bpy.context.evaluated_depsgraph_get()
            me = env.evaluated_get(dg).to_mesh()
            vs = [env.matrix_world @ v.co for v in me.vertices][:7]
            env.evaluated_get(dg).to_mesh_clear()
            pr = [project(cam, v) for v in vs]
            c = project(cam, sum(vs, Vector()) / len(vs))
            w = (max(q[0] for q in pr) - min(q[0] for q in pr)) * 1600
            hgt = (max(q[1] for q in pr) - min(q[1] for q in pr)) * 900
            line += f' | envelope {c[0]:.3f},{c[1]:.3f} at {c[2]:.0f} m, {w:.0f}x{hgt:.0f}px@1600'
        print(line, flush=True)
    sc.frame_set(START)


def build(args):
    sc = C.new_scene(START, END, args.quality, samples=args.samples, threads=args.threads)
    crane = Crane()
    fr = crane.fr
    kw = E.build_kwargs(fr)
    kw['floes_near'] = list(kw.get('floes_near', [])) + crane.path_xy()
    kw['sea_focus'] = tuple(crane.p1.lerp(crane.p0, 0.4).to_2d())
    parts = set(fr['include']) - {'hero_envelope'}
    h = E.build_offline(fr['state'], include=parts, frames=(START, END), **kw)
    E.tune_render(sc, args.quality, args.samples)
    if 'hero_padlock' in h['objects']:
        E.animate_hero_padlock(h)            # S06's padlock, at rest on the scree since f578
    envelope_lights(h, build_envelope(h, crane, kw.get('flock_count', 4000)), crane)
    E.apply_fills(h, fr.get('fills'))
    E.apply_values(h, fr.get('values'))
    E.apply_light_levels(h, fr.get('lights'))
    cam = build_camera(crane)
    sc.camera = cam
    E.set_shaft_camera(h, fr.get('shaft_camera', True))
    E.apply_look(fr['state'], **fr.get('look', {}))
    key_seed(sc, crane)
    report(h, cam, crane)
    sc.frame_set(START)
    return dict(h=h, cam=cam, crane=crane)


if __name__ == '__main__':
    a = C.shot_args()
    build(a)
    C.render(SHOT, a, START, END)
