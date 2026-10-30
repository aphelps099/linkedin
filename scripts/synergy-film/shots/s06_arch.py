"""S06 · f529-608 · the arch (E1_OFFLINE, day).

    blender -b --factory-startup -P shots/s06_arch.py -- --quality proof --only 529,544,548,552,553,559,560,566,578,608
    blender -b --factory-startup -P shots/s06_arch.py -- --quality final

Inside the cup, following Kevin's padlock in. A 50 mm lens 2 m above the
espresso, locked off on the open scree fan at the foot of the arch's left leg
(env_offline framing 's06_land', turned 3 degrees left so the leg stands on the
right third), which climbs out of the top of frame as a rim-lit column against
the glowing paper. The padlock, now the size of a three-storey building, is in
the last second of a long drop from the slot-sun: it tumbles into frame, its
brass faces flashing gold three times, strikes the scree, hops once, slides and
settles. Then one eased move tilts up the leg and pushes in while the arch
resolves into detail: brass at the foot, then brown patina, chalky verdigris
and lichen-crusted grey stone at the crest, and it lands on the env framing
's06_arch', the slot-sun centred in the arch's opening.

Sync points (film frames; 90 BPM, a beat every 16 frames):
  f529        the cut: the padlock is ~57 m up, falling at 52 m/s, above the frame
  f543-552    it tumbles into frame (half a turn every 4 frames): gold flashes on f544, f548, f552
  f553        impact on the scree (the half-beat): dust puff and motes from f554
  f553-566    one hop (apex ~f559), f567-578 slide and settle (it slides out of the bottom of frame ~f577)
  f560-608    the tilt-up and push-in, eased (peak 2.4 deg/frame ~f588), landing on the slot in the arch
              (under 0.2 deg/frame from f606)
The camera is locked off on f529-560.

Deviations from the treatment's camera numbers (composition and timing held):
the cup world puts the slot 63-68 degrees above a lens at shore level in front
of the arch, so the move tilts from +8 to +67.5 degrees (not 25 -> 55) and
pushes 67 m (121 m -> 55 m from the arch), between the Offline owner's
's06_land' and 's06_arch' framings. At +25 degrees from 150 m the landing on
the scree would sit below the frame, and the slot only sits inside the opening
from under the arch. The pines on the crest are on its top face, out of sight
from below.
"""

import json
import math
import os
import sys

import bpy
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
BOUNCE = 566            # the hop comes down
SETTLE = 578            # slid and settled
MOVE0, MOVE1 = 560, 608  # tilt up and push in, eased

# ------------------------------------------------------------------ the fall
IMPACT = 62.0           # m/s at the scree (env default 85): the last second of the drop starts 57 m up, so the
                        # padlock is in frame for ten frames before it lands, and a slower fall reads bigger
SPIN = 45.0             # deg/frame tumble over the visible fall (1.9 rev/s): half a turn every 4 frames, so
                        # a broad face turns through the same bright direction on f544, f548 and f552
FLASHES = (544, 548, 552)   # the three gold flashes (whole frames: the half-frame shutter catches them)
GLINT_DIST = 600.0      # m: the hero's glint card, out along the faces' mirror direction on the flash frames
GLINT_HALF = 12.0       # deg: its angular radius (a patch of hot slot-side paper and lid)
GLINT_L = 12.0          # its radiance (emission-strength units): x brass F0 ~0.45, a flash over the paper's 2.9 that
                        # AgX keeps gold (brighter washes out to white)
GLINT_K = 3600.0        # its colour temperature (the slot-side paper is 3200K)

# ------------------------------------------------------------------ look
LENS = 50.0
YAW_IN = 3.0            # deg: the opening frame turns left of 's06_land', the leg on the right third, the fall
                        # against open paper sky on the left
FILL = 0.25             # warm bounce card on the arch's shaded face (both env framings)
WALL_BOUNCE = (0.42, 0.75)   # paper bounce on the world: the day default ('s06_land') while locked off, so the leg
                        # stands as a rim-lit silhouette, rising with the tilt to the 's06_arch' value, so the
                        # arch resolves into detail as we climb it (diffuse rays only: the flashes keep their glow)
SCREE_PUDDLE_ROUGH = 0.16   # the wet scree's puddles (env 0.05 mirrors the lid like crumpled foil at 90 m): wet sheen
LOOK = dict(glare=0.6, glare_threshold=2.5, glare_rel_size=0.11)   # the slot-sun and the flashes bloom (S01's slot: 0.5)
DUST_GLOW = 1.0         # emission of the backlit dust puff (env 0.45): between the lens and the hot slot-side paper it
                        # forward-scatters and glows; at 0.45 it lay over the dark leg as a grey smudge once the tilt began
SEED_MOVE_DEG = 0.04    # camera turning faster than this (deg/frame): animated sampling seed, else fixed
MOVE_WARP = 1.2         # smootherstep on t**MOVE_WARP: a slower start (the hop and slide stay in frame to
                        # ~f577), peak ~2.4 deg/frame at f588, then a long ease into the slot (<0.2 deg/f from f606)

PARTS = {'cup', 'lid', 'shaft', 'sea', 'floes', 'arch', 'hero_padlock', 'blooms', 'gravity'}


def yaw_pitch(loc, tgt):
    d = Vector(tgt) - Vector(loc)
    return math.atan2(d.y, d.x), math.atan2(d.z, d.to_2d().length)


class Move:
    """The camera: locked off on 's06_land' until MOVE0, then one eased tilt and push to 's06_arch'."""

    def __init__(self):
        a, b = E.framing('s06_land'), E.framing('s06_arch')
        self.fa, self.fb = a, b
        self.p0, self.p1 = Vector(a['location']), Vector(b['location'])
        self.y0, self.t0 = yaw_pitch(a['location'], a['target'])
        self.y0 += math.radians(YAW_IN)
        self.y1, self.t1 = yaw_pitch(b['location'], b['target'])

    def u(self, f):
        t = min(1.0, max(0.0, (f - MOVE0) / float(MOVE1 - MOVE0)))
        return C.ease(t ** MOVE_WARP)

    def state(self, f):
        u = self.u(f)
        loc = self.p0.lerp(self.p1, u)
        yaw = self.y0 + (self.y1 - self.y0) * u
        pitch = self.t0 + (self.t1 - self.t0) * u
        return loc, yaw, pitch

    def euler(self, f):
        _loc, yaw, pitch = self.state(f)
        return Euler((math.pi / 2 + pitch, 0.0, yaw - math.pi / 2), 'XYZ')

    def turn_deg(self, f):
        """How far the view direction turns between f-1 and f (degrees)."""
        _l, ya, pa = self.state(f - 1)
        _l, yb, pb = self.state(f)
        return math.degrees(math.hypot((yb - ya) * math.cos(0.5 * (pa + pb)), pb - pa))

    def path_xy(self, n=8):
        return [tuple(self.p0.lerp(self.p1, i / (n - 1)).to_2d()) for i in range(n)]


def retumble(h):
    """Re-key the visible fall's tumble (env_offline keys 1.5 turns over the whole second).

    The centre path and the landing pose (f553) stay exactly as animate_hero_padlock solved them;
    only the spin before the landing changes: SPIN deg/frame about the env's tumble axis, so the
    padlock lands on the same frame in the same orientation. The swept volume is checked against
    the arch (core and padlock shell) with env_offline's own clearance test; if it would cut the
    leg, the env's tumble is kept.
    """
    hp = h['objects']['hero_padlock']
    sc = bpy.context.scene
    Vl = E._hero_local_verts(hp)
    cl = Vector(Vl.mean(0))
    axis = (Vector(E.ARCH_SPAN) * 0.8 + Vector((0, 0, 0.35))).normalized()
    path = []
    for f in range(START, LAND + 1):
        sc.frame_set(f)
        q = hp.rotation_quaternion.copy()
        path.append((f, hp.location + q.to_matrix() @ cl, q))
    q_land = path[-1][2]
    keys = []
    for f, c, _q in path[:-1]:
        q = Quaternion(axis, math.radians(SPIN) * (LAND - f)) @ q_land
        keys.append((f, c - q.to_matrix() @ cl, q))
    arch = h.get('arch')
    if arch is not None:
        walls = E._arch_bvh(arch, path[-1][1])
        hits = [f for f, loc, q in keys if E._hero_hits(Vl, loc, q, walls)]
        if hits:
            print(f'S06 WARNING retumble cuts the arch at {hits}: keeping the env tumble', flush=True)
            return False
    for f, loc, q in keys:
        hp.location = loc
        hp.rotation_quaternion = q
        hp.keyframe_insert('location', frame=f)
        hp.keyframe_insert('rotation_quaternion', frame=f)
    for fc in C.fcurves(hp.animation_data.action):
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'
    sc.frame_set(START)
    return True


def hero_glint(h, cam):
    """The gold flashes: a glossy-only disc that only the hero padlock sees (and only it shadows),
    standing where its broad faces mirror on the FLASHES frames: the hot paper and lid over the
    slot-side cliffs, which the cup's 6-degree key lamp is too small to stand in for on a flat face."""
    hp = h['objects']['hero_padlock']
    sc = bpy.context.scene
    rs, cs = [], []
    for f in FLASHES:
        sc.frame_set(f)
        M = hp.matrix_world
        n = (M.to_3x3().normalized() @ Vector((0, 1, 0))).normalized()
        c = M @ Vector((0, 0, 0.45))
        v = (c - cam.matrix_world.translation).normalized()
        rs.append(v - 2 * v.dot(n) * n)
        cs.append(c)
    d = (rs[0] + rs[1] + rs[2]).normalized()
    c = cs[1]
    size = 2 * GLINT_DIST * math.tan(math.radians(GLINT_HALF))
    area = math.pi * (size / 2) ** 2
    L = C.area_light('S06_HeroGlint', c + d * GLINT_DIST, target=c, energy=GLINT_L * math.pi * area, size=size,
                     shape='DISK', color=E.kelvin(GLINT_K))
    E._light_vis(L, camera=False, diffuse=False, glossy=True, transmission=False)
    L.data.cycles.max_bounces = 1
    rc = bpy.data.collections.new('S06_GlintLink')        # not in the scene: a link set
    rc.objects.link(hp)
    L.light_linking.receiver_collection = rc
    L.light_linking.blocker_collection = rc
    spread = max(math.degrees(r.angle(d)) for r in rs)
    print(f'S06 glint dir {tuple(round(x, 3) for x in d)} spread {spread:.1f} deg, disc {size:.0f} m', flush=True)
    sc.frame_set(START)
    return L


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


def build_camera(move):
    cam = E.camera_offline(LENS, move.p0, move.fa['target'], fstop=0.0)
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


def key_bounce(h, move):
    """WallBounce follows the move: WALL_BOUNCE[0] until the tilt starts, WALL_BOUNCE[1] when it lands."""
    node = h['mats']['wall'].node_tree.nodes['WallBounce']
    a, b = WALL_BOUNCE
    for f in [START - 2] + list(range(MOVE0, MOVE1 + 1)) + [END + 2]:
        E.key_value(node, f, a + (b - a) * move.u(f))


def key_seed(sc, move):
    """Fixed sampling seed while the lens is still (nothing static boils), animated while it turns
    (no noise pattern stuck to the screen as the world slides through it)."""
    cy = sc.cycles
    cy.use_animated_seed = False
    for f in range(START - 2, END + 3):
        moving = MOVE0 < f <= MOVE1 and max(move.turn_deg(f), move.turn_deg(min(f + 1, MOVE1))) > SEED_MOVE_DEG
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


def report(h, cam, move):
    """Print where the hero padlock and the slot sit in frame at the sync points."""
    sc = bpy.context.scene
    hp = h['objects']['hero_padlock']
    for f in (START, 541, 545, 549, LAND, 559, BOUNCE, SETTLE, 584, 592, 600, END):
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        ob = hp.evaluated_get(dg)
        pts = [ob.matrix_world @ Vector(c) for c in ob.bound_box]
        xs, ys = zip(*[project(cam, p)[:2] for p in pts])
        sx, sy, sz = project(cam, E.SLOT_C)
        print(f'S06 f{f} padlock x {min(xs):.2f}..{max(xs):.2f} y {min(ys):.2f}..{max(ys):.2f} '
              f'| slot {sx:.3f},{sy:.3f} | cam {tuple(round(v, 1) for v in cam.matrix_world.translation)} '
              f'pitch {math.degrees(move.state(f)[2]):.1f} turn {move.turn_deg(f):.2f} seed {sc.cycles.seed}', flush=True)


def build(args):
    sc = C.new_scene(START, END, args.quality, samples=args.samples, threads=args.threads)
    move = Move()
    a = move.fa
    h = E.build_offline('day', include=PARTS, frames=(START, END), sea_focus=a['sea_focus'],
                        floes_near=move.path_xy(), fill=FILL)
    E.tune_render(sc, args.quality, args.samples)
    E.animate_hero_padlock(h, START, LAND, BOUNCE, SETTLE, impact_speed=IMPACT)
    retumble(h)
    E.apply_fills(h, None)
    E.apply_values(h, {'wall': {'WallBounce': WALL_BOUNCE[0]}})
    E.apply_light_levels(h, None)
    soften_puddles(h)
    glow_dust(h)
    cam = build_camera(move)
    sc.camera = cam
    key_bounce(h, move)
    hero_glint(h, cam)
    E.set_shaft_camera(h, True)
    E.apply_look('day', **LOOK)
    key_seed(sc, move)
    report(h, cam, move)
    sc.frame_set(START)
    return dict(h=h, cam=cam, move=move)


if __name__ == '__main__':
    a = C.shot_args()
    build(a)
    C.render(SHOT, a, START, END)
