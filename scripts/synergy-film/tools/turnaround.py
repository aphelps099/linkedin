"""Synergy model turnaround in a neutral photo studio.

    blender -b -P tools/turnaround.py -- --out /path/to/dir [--only hero,head] [--samples 16]
        [--light office|studio] [--quality preview] [--extras]

Renders hero.png, head.png, full_front.png, full_side.png, full_back34.png,
hand_cup.png, thumbs_up.png and walk_mid.png (960x540 by default); --extras adds
preset_sip, preset_reach_L, preset_hands_clasped, preset_seated and preset_post_L, plus the
critics' close-ups: c_badge (85 mm on the badge), c_lid_top (the S02 opening: 100 mm macro
26 cm above the lid, top-down), c_torso_macro (100 mm on the chip plate and the big grey
panel), c_post (85 mm on the posting pinch) and c_legs.

Lighting 'office' (default): the key comes from above and camera-right like the canonical
office plate (crown brightest, the wedge in half-shade), a softened 6500K overhead panel, a
neutral floor bounce and a fill, plus two rims. A glossy-only soft-ended card is re-aimed per
view so the face glass shows one thin reflected skylight slot near its top edge.

After each render it prints MEASURE lines (skip with --no-measure): median colours at projected
points on the cream and grey plates, the blue chip and the badge glyph (green excess), the
luminance spread inside each visible torso plate (the oil-can sheen), and for hero.png the
pauldron apex against the torso top line in pixels. Eye samples are only meaningful from the
in-room frames (tools/synergy_in_room.py), not at this exposure.
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
    p.add_argument('--extras', action='store_true',
                   help='also render preset_*.png (sip, reach_L, hands_clasped, seated, post_L)')
    p.add_argument('--light', default='office', choices=('office', 'studio'))
    p.add_argument('--quality', default='preview', help='material Bevel/AO tier (materials.set_quality)')
    p.add_argument('--exposure', type=float, default=-0.8,
                   help='view exposure; -0.7 puts lit cream near the office plate (#CBAD8C-#D9C3AC)')
    p.add_argument('--no-measure', action='store_true', help='skip the MEASURE lines after each render')
    return p.parse_args(argv)


# ------------------------------------------------------------------ measurement

def _pixels(path):
    img = bpy.data.images.load(path, check_existing=False)
    w, h = img.size
    px = list(img.pixels[:])
    bpy.data.images.remove(img)
    return w, h, px


def _proj(cam, p):
    from bpy_extras.object_utils import world_to_camera_view
    co = world_to_camera_view(bpy.context.scene, cam, p)
    return co if (0 <= co.x <= 1 and 0 <= co.y <= 1 and co.z > 0) else None


def _med(px, w, h, x, y, r=2):
    cols = []
    for yy in range(max(0, y - r), min(h, y + r + 1)):
        for xx in range(max(0, x - r), min(w, x + r + 1)):
            i = (yy * w + xx) * 4
            cols.append(px[i:i + 3])
    if not cols:
        return None
    return [sorted(c[k] for c in cols)[len(cols) // 2] for k in range(3)]


def _hex(c):
    return '#%02X%02X%02X' % tuple(int(round(max(0.0, min(1.0, v)) * 255)) for v in c)


def _lum(c):
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]


def measure(name, path, rig, cam, f):
    """Print colour samples and plate gradients for one rendered view."""
    import colorsys
    sc = bpy.context.scene
    sc.frame_set(f)
    dg = bpy.context.evaluated_depsgraph_get()
    w, h, px = _pixels(path)

    def at(p, r=2):
        co = _proj(cam, p)
        if co is None:
            return None
        return _med(px, w, h, int(co.x * w), int(co.y * h), r)

    def plate_tris(o):
        flat = list(o['plate_tris'])
        ev = o.evaluated_get(dg)
        Mw = ev.matrix_world
        loc = Vector(o.location)
        return [[Mw @ (Vector(flat[i + 3 * j:i + 3 * j + 3]) - loc) for j in range(3)] for i in range(0, len(flat), 9)]
    out = []
    grads = []
    for o in rig.torso_plates + rig.head_plates:
        if 'plate_tris' not in o or o.get('plate_kind') == 'dark':
            continue
        tris = plate_tris(o)
        big = max(tris, key=lambda t: (t[1] - t[0]).cross(t[2] - t[0]).length)
        c = sum(big, Vector()) / 3.0
        nrm = (big[1] - big[0]).cross(big[2] - big[0]).normalized()
        if (cam.matrix_world.translation - c).dot(nrm) <= 0:
            continue
        col = at(c + nrm * 0.0003)
        if col is None:
            continue
        key = o.name.split('_', 1)[1]
        out.append((key, o.get('plate_kind'), col))
        # luminance spread across the plate: 9 points between the centre and 70% toward its corners
        ls = []
        for t in big:
            for k in (0.35, 0.7):
                q = c.lerp(t, k) + nrm * 0.0003
                cc = at(q, 1)
                if cc is not None:
                    ls.append(_lum(cc))
        if len(ls) >= 4 and key.startswith('torso_f'):
            grads.append((key, (max(ls) - min(ls)) * 255))
    print(f'MEASURE {name}', flush=True)
    for key, kind, col in out:
        hh, ll, ss = colorsys.rgb_to_hls(*[max(0.0, min(1.0, v)) for v in col])
        print(f'    {key:22s} {kind:10s} {_hex(col)}  L{ll:.2f} S{ss:.2f} H{hh * 360:4.0f}', flush=True)
    if grads:
        print('    torso plate luminance spread /255: ' + ', '.join(f'{k[6:]} {g:.0f}' for k, g in grads) +
              f'   (plates >= 12: {sum(1 for _, g in grads if g >= 12)})', flush=True)
    chip = rig.parts.get('blue_chip')
    if chip is not None:
        ev = chip.evaluated_get(dg)
        cc = at(ev.matrix_world.translation, 1)
        if cc is not None:
            hh, ll, ss = colorsys.rgb_to_hls(*[max(0.0, min(1.0, v)) for v in cc])
            print(f'    blue_chip {_hex(cc)} L{ll:.2f} S{ss:.2f}', flush=True)
    badge = rig.badge
    if badge is not None:
        ev = badge.evaluated_get(dg)
        me = ev.to_mesh()
        uvl = me.uv_layers.active
        best = 0.0
        if uvl is not None:
            # the glyph: 2 x 3 cells round (0.5, 0.56) in card UV; scan points over it
            vs = [ev.matrix_world @ v.co for v in me.vertices]
            lo = Vector((min(v.x for v in vs), min(v.y for v in vs), min(v.z for v in vs)))
            hi = Vector((max(v.x for v in vs), max(v.y for v in vs), max(v.z for v in vs)))
            for i in range(-6, 7):
                for j in range(-8, 9):
                    q = Vector(((lo.x + hi.x) / 2 + i * 0.0015, lo.y - 0.0008, (lo.z + hi.z) / 2 + 0.004 + j * 0.0015))
                    cc = at(q, 0)
                    if cc is not None:
                        best = max(best, (cc[1] - max(cc[0], cc[2])) * 255)
        ev.to_mesh_clear()
        print(f'    badge glyph max green excess {best:.0f}', flush=True)
    if name == 'hero':
        def top_px(objs):
            ys = []
            for o in objs:
                ev = o.evaluated_get(dg)
                me = ev.to_mesh()
                for v in me.vertices:
                    co = _proj(cam, ev.matrix_world @ v.co)
                    if co is not None:
                        ys.append(co.y * h)
                ev.to_mesh_clear()
            return max(ys) if ys else None
        tt = top_px([o for o in rig.torso_plates if o.name.split('_', 1)[1].startswith('torso_t_')])
        for s_ in 'LR':
            pp = top_px([rig.parts[f'pauldron_{s_}']])
            if tt is not None and pp is not None:
                print(f'    pauldron_{s_} apex {pp - tt:+.0f} px vs the torso top line', flush=True)


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


def studio(light='office'):
    coll = C.collection('Studio')
    cyclorama(coll)
    C.set_world_color((0.20, 0.21, 0.23), 0.18)
    # key: above and camera-right (the character's left), so the crown is the brightest facet and
    # the wedge (his right) sits in half-shade, as in the office plate
    C.area_light('Key', (1.7, -2.3, 3.5), target=(0, 0, 1.40), energy=330, size=1.6, color=(1.0, 0.88, 0.74),
                 coll=coll)
    C.area_light('Fill', (-2.9, -2.2, 1.6), target=(0, 0, 1.1), energy=110 if light == 'office' else 70, size=2.5,
                 color=(0.9, 0.95, 1.0), coll=coll)
    if light == 'office':
        # 6500K overhead soft panel and a neutral bounce from the floor / desk in front
        C.area_light('Overhead', (0.0, -0.5, 3.3), target=(0, -0.3, 0.0), energy=60, size=2.0, size_y=1.0,
                     color=(0.93, 0.96, 1.0), coll=coll)
        C.area_light('Bounce', (0.0, -1.5, 0.4), target=(0, 0, 1.25), energy=16, size=1.4, size_y=0.6,
                     color=(1.0, 0.93, 0.86), coll=coll)
    C.area_light('RimL', (1.9, 1.7, 2.5), target=(0, 0, 1.3), energy=240, size=0.6, size_y=1.8,
                 color=(1.0, 0.97, 0.92), coll=coll)
    C.area_light('RimR', (-2.0, 1.5, 2.2), target=(0, 0, 1.3), energy=200, size=0.6, size_y=1.8,
                 color=(0.92, 0.96, 1.0), coll=coll)
    C.area_light('Top', (0.0, 0.3, 3.6), target=(0, 0, 1.0), energy=50, size=2.0, color=(1.0, 0.93, 0.85), coll=coll)


def key_hidden(objs, f, hidden, around=()):
    for o in objs:
        o.hide_render = hidden
        o.keyframe_insert('hide_render', frame=f)
        for fr in around:
            o.hide_render = not hidden
            o.keyframe_insert('hide_render', frame=fr)
        for fc in C.fcurves(o.animation_data.action):
            if fc.data_path == 'hide_render':
                for kp in fc.keyframe_points:
                    kp.interpolation = 'CONSTANT'


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


def cam_location(cam, f):
    bpy.context.scene.frame_set(f)
    return cam.matrix_world.translation.copy()


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
    sc.view_settings.exposure = a.exposure
    M.set_quality(a.quality)
    studio(a.light)
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

    # 1 hero: canonical 3/4 waist-up, head rolled 7 deg, cup in the right hand; ~5% headroom
    f = 1
    base(f, 'idle_cup_high')
    rig.pose(f, CONST, head=(-3, 7, -4), neck=(0, 0, -2))
    key_cam(cam, f, orbit((0, 0, 1.40), 2.02, -8, 1.36), (-0.07, 0, 1.415), 50, fstop=2.8,
            focus=1.95)
    views['hero'] = f
    # 2 head close-up
    f = 2
    base(f)
    rig.pose(f, CONST, head=(0, 7, 2))
    hc = Vector((-0.01, -0.06, 1.575))
    key_cam(cam, f, orbit(hc, 1.75, -14, 1.60), hc, 85, fstop=4.0)
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
    key_cam(cam, f, orbit(cupc, 0.62, 14, 1.56), cupc + Vector((0.0, 0, 0.02)), 85, fstop=5.6)
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
        cup_objs = rig.cup_objects()
        hs_objs = ([rig.headset] + list(rig.headset.children_recursive) + [rig.parts.get('headset_cord'),
                                                                            rig.parts.get('headset_plug')]) \
            if rig.headset else []
        hs_objs = [o for o in hs_objs if o is not None]
        others = (1, 2, 3, 4, 5, 6, 7, 99, 100, 152)
        for k, (name, preset) in enumerate((('preset_sip', 'sip'), ('preset_reach_L', 'reach_L'),
                                            ('preset_hands_clasped', 'hands_clasped'), ('preset_seated', 'seated'),
                                            ('preset_post_L', 'post_L'))):
            f = 10 + k
            base(f, preset)
            lens, dist, h, tz = (50, 3.0, 1.35, 1.3) if preset != 'seated' else (50, 3.6, 1.25, 1.0)
            tgt = (0, -0.1, tz)
            if preset == 'sip':
                lens, dist, h, tz = 65, 1.9, 1.35, 1.42      # S13 framing: slightly low, 8 deg to his right
                tgt = (0, -0.05, 1.40)
                key_cam(cam, f, orbit((0, 0, tz), dist, -8, h), tgt, lens)
            elif preset == 'post_L':
                pos, ax = rig.slot_world(f)
                key_cam(cam, f, orbit(pos, 1.25, -24, 1.52), pos + Vector((0.03, 0, 0.03)), 85, fstop=5.6)
            else:
                key_cam(cam, f, orbit((0, 0, tz), dist, -28, h), tgt, lens)
            views[name] = f
        # critics' close-ups
        dg = None

        def setv(name, f, preset, loc_fn, lens, fstop, focus=None):
            base(f, preset)
            sc.frame_set(f)
            loc, tgt = loc_fn(f)
            key_cam(cam, f, loc, tgt, lens, fstop=fstop, focus=focus)
            views[name] = f

        def badge_view(f):
            b = rig.badge.evaluated_get(bpy.context.evaluated_depsgraph_get()).matrix_world.translation.copy()
            return (b.x - 0.10, b.y - 0.55, b.z + 0.08), (b.x, b.y, b.z + 0.03)

        def lid_view(f):
            pos, ax = rig.slot_world(f)
            return (pos.x + 0.001, pos.y - 0.004, pos.z + 0.26), pos

        def torso_view(f):
            return (0.16, -0.75, 1.22), (0.06, -0.16, 1.17)

        def post_view(f):
            pos, ax = rig.slot_world(f)
            return (pos.x - 0.25, pos.y - 0.45, pos.z + 0.22), pos + Vector((0, 0, 0.03))

        def legs_view(f):
            return (0.9, -2.0, 0.55), (0.0, 0.0, 0.50)
        setv('c_badge', 15, 'idle_cup', badge_view, 85, 5.6)
        setv('c_lid_top', 16, 'idle_cup', lid_view, 100, 4.0, 0.26)
        setv('c_torso_macro', 17, 'idle_cup', torso_view, 100, 5.6)
        setv('c_post', 18, 'post_L', post_view, 85, 5.6)
        setv('c_legs', 19, 'idle_cup', legs_view, 50, 0.0)
        others = others + (15, 16, 17, 18, 19)
        key_hidden(cup_objs, 12, True, around=[fr for fr in others + (10, 11, 13, 14)])   # steeple: hands free
        key_hidden(hs_objs, 10, True, around=[fr for fr in others + (11, 12, 13, 14)])    # S13: headset is off
    for name, f in views.items():
        rig.glass_glint(cam_location(cam, f), f)
    C.compositor(glare=0.4, glare_threshold=0.8, glare_size=6)
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
        if not a.no_measure:
            try:
                measure(name, sc.render.filepath, rig, cam, f)
            except Exception as e:      # measurement never blocks a render pass
                print(f'MEASURE {name} failed: {e}', flush=True)


main()
