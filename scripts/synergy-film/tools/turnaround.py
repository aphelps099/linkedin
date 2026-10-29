"""Synergy model turnaround in a neutral photo studio.

    blender -b -P tools/turnaround.py -- --out /path/to/dir [--only hero,head] [--samples 16]

Renders hero.png, head.png, full_front.png, full_side.png, full_back34.png,
hand_cup.png, thumbs_up.png and walk_mid.png (960x540 by default).
"""

import argparse
import math
import os
import sys
import time

import bmesh
import bpy
from mathutils import Vector

LIB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'lib')
sys.path.insert(0, LIB)

import common as C  # noqa: E402
import face as F  # noqa: E402
import materials as M  # noqa: E402
import synergy as S  # noqa: E402


def args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument('--out', required=True)
    p.add_argument('--only', default='')
    p.add_argument('--samples', type=int, default=16)
    p.add_argument('--res', default='960x540')
    p.add_argument('--save-blend', default='')
    p.add_argument('--no-render', action='store_true')
    p.add_argument('--extras', action='store_true', help='also render preset_*.png (sip, reach_L, hands_clasped, seated)')
    return p.parse_args(argv)


def cyclorama(coll):
    """Seamless floor-to-wall sweep behind the subject (+Y)."""
    bm = bmesh.new()
    prof = [(-8.0, 0.0), (2.0, 0.0)]
    R = 1.6
    for i in range(1, 17):
        a = math.pi / 2 * i / 16
        prof.append((2.0 + R * math.sin(a), R * (1 - math.cos(a))))
    prof.append((2.0 + R, 7.0))
    xs = (-9.0, 9.0)
    rows = []
    for y, z in prof:
        rows.append([bm.verts.new((x, y, z)) for x in xs])
    for a, b in zip(rows, rows[1:]):
        bm.faces.new((a[0], a[1], b[1], b[0]))
    for f in bm.faces:
        f.smooth = True
    me = bpy.data.meshes.new('cyc')
    bm.to_mesh(me)
    bm.free()
    obj = bpy.data.objects.new('Cyclorama', me)
    coll.objects.link(obj)
    mat = M.flat('studio_cyc', (0.105, 0.10, 0.095), rough=0.85)
    me.materials.append(mat)
    return obj


def studio():
    coll = C.collection('Studio')
    cyclorama(coll)
    C.set_world_color((0.20, 0.21, 0.23), 0.18)
    C.area_light('Key', (-2.3, -2.6, 3.1), target=(0, 0, 1.35), energy=360, size=1.6, color=(1.0, 0.86, 0.70),
                 coll=coll)
    C.area_light('Fill', (2.9, -2.2, 1.6), target=(0, 0, 1.1), energy=80, size=2.5, color=(0.9, 0.95, 1.0),
                 coll=coll)
    C.area_light('RimL', (1.9, 1.7, 2.5), target=(0, 0, 1.3), energy=260, size=0.6, size_y=1.8,
                 color=(1.0, 0.97, 0.92), coll=coll)
    C.area_light('RimR', (-2.0, 1.5, 2.2), target=(0, 0, 1.3), energy=200, size=0.6, size_y=1.8,
                 color=(0.92, 0.96, 1.0), coll=coll)
    C.area_light('Top', (0.0, 0.3, 3.6), target=(0, 0, 1.0), energy=90, size=2.0, color=(1.0, 0.93, 0.85), coll=coll)


def key_cam(cam, f, loc, target, lens, fstop=0.0, focus=None, roll=0.0):
    cam.location = Vector(loc)
    C.look_at(cam, Vector(target), roll)
    cam.keyframe_insert('location', frame=f)
    cam.keyframe_insert('rotation_euler', frame=f)
    cam.data.lens = lens
    cam.data.keyframe_insert('lens', frame=f)
    cam.data.dof.use_dof = fstop > 0
    cam.data.dof.keyframe_insert('use_dof', frame=f)
    if fstop > 0:
        cam.data.dof.aperture_fstop = fstop
        cam.data.dof.focus_distance = focus if focus else (Vector(target) - Vector(loc)).length
        cam.data.dof.keyframe_insert('aperture_fstop', frame=f)
        cam.data.dof.keyframe_insert('focus_distance', frame=f)


def orbit(target, dist, yaw_deg, height):
    a = math.radians(yaw_deg)
    t = Vector(target)
    return (t.x + dist * math.sin(a), t.y - dist * math.cos(a), height)


def main():
    a = args()
    t0 = time.time()
    sc = C.new_scene(1, 200, 'preview', samples=a.samples)
    w, h = (int(x) for x in a.res.split('x'))
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.use_motion_blur = False
    studio()
    tl = F.FaceTimeline(1, 200)
    rig = S.build(timeline=tl)
    print(f'BUILD {time.time() - t0:.1f}s objects={len(bpy.data.objects)}', flush=True)
    cam = C.camera('Cam', lens=50, location=(0, -4, 1.4), target=(0, 0, 1.3))
    views = {}
    CONST = 'CONSTANT'

    def base(f, preset='idle_cup', heading=0.0):
        rig.rest(f, CONST)
        rig.apply_preset(f, preset, CONST)
        rig.pose(f, CONST, root_loc=(0, 0, 0), root_rot=heading)

    # 1 hero: canonical 3/4 waist-up, head rolled 7 deg, cup in the right hand
    f = 1
    base(f, 'idle_cup_high')
    rig.pose(f, CONST, head=(-3, 7, -4), neck=(0, 0, -2))
    key_cam(cam, f, orbit((0, 0, 1.36), 1.78, -8, 1.32), (-0.07, 0, 1.36), 50, fstop=2.8,
            focus=1.72)
    views['hero'] = f
    # 2 head close-up
    f = 2
    base(f)
    rig.pose(f, CONST, head=(0, 7, 2))
    hc = Vector((-0.01, -0.06, 1.575))
    key_cam(cam, f, orbit(hc, 1.75, -14, 1.50), hc, 85, fstop=4.0)
    views['head'] = f
    # 3-5 full body
    for f, name, heading in ((3, 'full_front', 0.0), (4, 'full_side', -90.0), (5, 'full_back34', 145.0)):
        base(f, heading=heading)
        key_cam(cam, f, (0, -5.6, 1.0), (0, 0, 0.9), 50)
        views[name] = f
    # 6 hand + cup macro
    f = 6
    base(f)
    sc.frame_set(f)
    dg = bpy.context.evaluated_depsgraph_get()
    cupc = rig.cup.evaluated_get(dg).matrix_world @ Vector((0, 0, 0.055))
    key_cam(cam, f, orbit(cupc, 0.62, 14, 1.31), cupc + Vector((0.0, 0, 0.0)), 85, fstop=5.6)
    views['hand_cup'] = f
    # 7 thumbs up
    f = 7
    base(f, 'thumbs_up')
    key_cam(cam, f, orbit((0, 0, 1.33), 2.2, -4, 1.34), (0.0, 0, 1.33), 50, fstop=2.8, focus=2.1)
    views['thumbs_up'] = f
    # 8 walk (mid stride)
    rig.rest(99, CONST)
    rig.apply_preset(99, 'idle_cup', CONST)
    rig.pose(99, CONST, root_loc=(0, 1.2, 0), root_rot=0)
    rig.apply_preset(100, 'idle_cup', 'LINEAR')
    rig.walk(100, 196, (0.0, 1.2), (0.0, -1.2), step_frames=14)
    fw = 152
    key_cam(cam, fw, orbit((0, 0, 0.9), 5.2, -32, 1.1), (0, -0.1, 0.85), 50)
    views['walk_mid'] = fw

    if a.extras:
        cup = rig.cup
        for k, (name, preset) in enumerate((('preset_sip', 'sip'), ('preset_reach_L', 'reach_L'),
                                            ('preset_hands_clasped', 'hands_clasped'), ('preset_seated', 'seated'))):
            f = 10 + k
            base(f, preset)
            cup.hide_render = (preset == 'hands_clasped')   # the steeple needs both hands free
            cup.keyframe_insert('hide_render', frame=f)
            lens, dist, h, tz = (50, 3.0, 1.35, 1.3) if preset != 'seated' else (50, 3.6, 1.05, 0.85)
            key_cam(cam, f, orbit((0, 0, tz), dist, -28, h), (0, -0.1, tz), lens)
            views[name] = f
        for fr in (1, 2, 3, 4, 5, 6, 7, 99, 100, 152):
            cup.hide_render = False
            cup.keyframe_insert('hide_render', frame=fr)
    C.compositor(glare=0.25, glare_threshold=1.2, glare_size=6)
    if a.save_blend:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(a.save_blend))
    if a.no_render:
        return
    os.makedirs(a.out, exist_ok=True)
    only = [x for x in a.only.split(',') if x]
    for name, f in views.items():
        if only and name not in only:
            continue
        t1 = time.time()
        sc.frame_set(f)
        sc.render.filepath = os.path.join(a.out, name + '.png')
        bpy.ops.render.render(write_still=True)
        print(f'RENDERED {name} frame={f} {time.time() - t1:.1f}s', flush=True)


main()
