"""Preview renders of the Long Room (E2), the macro inserts (E3) and a prop contact sheet.

    blender -b -P tools/preview_room.py -- --out DIR [--quality proof] [--only s03_wide,props_sheet]
                                           [--samples N] [--save-blend PATH] [--res-scale F] [--no-budget]
                                           [--threads N] [--frames N,N,...]

Framings (film frames, from the treatment; each swivels the chairs to its shot's
R.SHOT_SEAT_YAW, shows only its insert kit, applies the room's render budget for its
kind (R.PREVIEW_BUDGET: 'macro' for the inserts, 'wide' otherwise; an explicit --samples
is never lowered) and retunes the CRT scanlines for its lens):
    s02_lid           f140   the S01/S02 match cut: 100 mm straight down on the lid ('lid' kit)
    s02_end           f250   S02's end position, 65 mm f/2, colour discs behind him (Room.front_bokeh)
    s03_wide          f300   the drop: one-point wide from behind the foot, printer + droid below
    s04_start         f364   Kevin speaks; padlock still at home, lens 3 cm above the walnut
    s04_tabletop      f390   riding beside the gliding padlock
    s05_medium        f470   85 mm f/2 medium, colour discs behind him
    s07_profile_lane  f712   from his left, down-table: him at frame right, the droid's stop at his hip
    s09_low           f870   lens 6 cm above the walnut, 0.9 m down-table, looking back up at him (28 mm)
    s10_jack_macro    f950   100 mm f/8 macro of the socket and gold jack from beyond the head edge
    s11_shutdown      f1030  from behind-left of the host, the shutdown wave mid-way
    s11_pat           f1110  the dark room; Pat's grey field at the far end
    s13_dark          f1300  dark state: the slab as top key, the 'sip' kit on the cup, Pat's disc
    macro_<prop>             100 mm macros of padlock / envelope / tabs / binder / zero on the
                             walnut under the room's slab
    props_sheet              studio contact sheet of every prop (4 x 4 tiles)

Synergy is a 1.75 m grey stand-in at SYNERGY_POS. Each image is written to
<out>/<name>.png (with --frames, <out>/<name>_fNNNN.png per frame); render cost is printed
as 'TIME <name> <wall s> cpu=<CPU s>' and a summary 'COST' table at the end, with the load
average before and after each render (wall time is only the idle cost when the load is
~0; --threads 4 pins Cycles to 4 threads). Room.set_state is regression-checked before
rendering; the S11 framings get a projection/occlusion check (every shutdown screen and
Pat must project inside the frame and clear of a 0.75 m Synergy silhouette).
"""

import argparse
import math
import os
import resource
import sys
import time

import bpy
from mathutils import Vector

LIB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'lib')
sys.path.insert(0, LIB)

import common as C  # noqa: E402
import props as P  # noqa: E402

ALL = ['s03_wide', 's04_start', 's04_tabletop', 's07_profile_lane', 's09_low', 's10_jack_macro', 's11_shutdown',
       's11_pat', 's13_dark', 's02_end', 's02_lid', 's05_medium', 'macro_padlock', 'macro_envelope', 'macro_tabs',
       'macro_binder', 'macro_zero', 'props_sheet']


def args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument('--out', required=True)
    p.add_argument('--quality', default='proof', choices=sorted(C.QUALITY))
    p.add_argument('--only', default='')
    p.add_argument('--samples', type=int, default=0)
    p.add_argument('--save-blend', default='')
    p.add_argument('--tile', default='480x270')
    p.add_argument('--res-scale', type=float, default=1.0)
    p.add_argument('--no-budget', action='store_true', help="keep the tier's own settings (no room budget)")
    p.add_argument('--tiles', default='', help='props_sheet: only these tiles (comma list, e.g. padlock,envelope)')
    p.add_argument('--threads', type=int, default=0, help='pin Cycles to N threads (wall-clock cost measurement)')
    p.add_argument('--frames', default='', help='room framings: render these film frames instead of the default')
    return p.parse_args(argv)


def cpu_seconds():
    r = resource.getrusage(resource.RUSAGE_SELF)
    return r.ru_utime + r.ru_stime


def load():
    try:
        return os.getloadavg()[0]
    except OSError:
        return -1.0


def render_to(path, label):
    sc = bpy.context.scene
    sc.render.filepath = path
    l0 = load()
    t0, c0 = time.time(), cpu_seconds()
    bpy.ops.render.render(write_still=True)
    dt, dc = time.time() - t0, cpu_seconds() - c0
    print(f'TIME {label} {dt:.1f} cpu={dc:.1f} load={l0:.2f}->{load():.2f}', flush=True)
    return dt


# ================================================================== props sheet


def studio_rig():
    """Unit-size seamless sweep + key/fill/rim, scaled per tile to the prop."""
    import bmesh
    coll = C.collection('Studio')
    rig = C.empty('studio_rig', coll)
    bm = bmesh.new()
    prof = [(-6.0, 0.0), (0.6, 0.0)]
    R = 0.9
    for i in range(1, 17):
        a = math.pi / 2 * i / 16
        prof.append((0.6 + R * math.sin(a), R * (1 - math.cos(a))))
    prof.append((0.6 + R, 5.0))
    rows = [[bm.verts.new((x, y, z)) for x in (-6.0, 6.0)] for y, z in prof]
    for a, b in zip(rows, rows[1:]):
        bm.faces.new((a[0], a[1], b[1], b[0]))
    cyc = P.to_object(bm, 'studio_sweep', [P.flat((0.16, 0.16, 0.165), 0.85)], coll, smooth=40.0)
    cyc.parent = rig
    lights = [
        C.area_light('st_key', (-1.4, -1.5, 1.6), (0, 0, 0.25), 60, 1.2, color=(1.0, 0.95, 0.9), coll=coll),
        C.area_light('st_fill', (1.6, -1.2, 0.8), (0, 0, 0.25), 18, 1.6, color=(0.85, 0.92, 1.0), coll=coll),
        C.area_light('st_rim', (0.9, 1.3, 1.4), (0, 0, 0.3), 45, 0.8, color=(1.0, 1.0, 1.0), coll=coll),
        C.area_light('st_top', (0.0, 0.0, 2.0), (0, 0, 0), 15, 1.5, coll=coll),
    ]
    base_e = [l.data.energy for l in lights]
    for l in lights:
        l.parent = rig
    return rig, lights, base_e


def bbox_world(objs):
    dg = bpy.context.evaluated_depsgraph_get()
    lo = Vector((1e9, 1e9, 1e9))
    hi = -lo
    for o in objs:
        items = []
        if o.type in ('MESH', 'CURVE'):
            items.append((o.evaluated_get(dg), o.matrix_world))
        elif o.instance_type == 'COLLECTION' and o.instance_collection:
            for po in o.instance_collection.objects:
                if po.type == 'MESH':
                    items.append((po.evaluated_get(dg), o.matrix_world @ po.matrix_world))
        for ev, mw in items:
            for c in ev.bound_box:
                w = mw @ Vector(c)
                lo = Vector(map(min, lo, w))
                hi = Vector(map(max, hi, w))
    return lo, hi


def all_children(obj):
    out = [obj]
    for c in obj.children:
        out += all_children(c)
    return out


def props_sheet(a):
    sc = C.new_scene(1, 400, a.quality, a.samples)
    tw, th = (int(x) for x in a.tile.split('x'))
    sc.render.resolution_x, sc.render.resolution_y = tw, th
    sc.render.use_motion_blur = False
    C.set_world_color((0.05, 0.055, 0.06), 1.0)
    rig, lights, base_e = studio_rig()
    tiles = []
    gap = 8.0

    def slot(i):
        return Vector((i * gap, 0.0, 0.0))

    def add(name, objs, aim=(0.0, 0.0, 0.0), view=(-0.55, -1.0, 0.45), fill=0.75, frame=1, lens=50.0, size=None):
        tiles.append(dict(name=name, objs=objs, aim=Vector(aim), view=Vector(view), fill=fill, frame=frame,
                          lens=lens, size=size))

    k = 0
    # 1 terminal speaking (Kevin)
    t = P.crt_terminal('kevin', P.TERMINAL_HEX['kevin'], None, slot(k))
    t.speak(2, 40, seed=4)
    add('terminal_kevin', all_children(t.root), view=(-0.75, 1.0, 0.35), frame=12)
    k += 1
    # 2 terminal dead (Pat)
    t2 = P.crt_terminal('pat', P.TERMINAL_HEX['pat'], None, slot(k), powered=False)
    add('terminal_pat_off', all_children(t2.root), view=(0.75, 1.0, 0.35))
    k += 1
    # 3 a colleague: terminal on its chair (Strategy, acid yellow)
    ch = P.office_chair('chair_demo', None, slot(k), 0.0)
    t3 = P.crt_terminal('strategy', P.TERMINAL_HEX['strategy'], None, slot(k) + Vector((0, 0.04, P.CHAIR['seat_top'])))
    add('colleague', [ch] + all_children(t3.root), view=(-0.8, 1.0, 0.45), size=(1.2, 1.4))
    k += 1
    # 4 empty chair (back three-quarter)
    ch2 = P.office_chair('chair_back', None, slot(k), 0.0)
    add('chair', [ch2], view=(0.9, -1.0, 0.5), size=(1.0, 1.4))
    k += 1
    # 5 printer, stack and a sheet mid-feed
    pr = P.laser_printer('printer', None, slot(k) + Vector((0, 0, 0.55)), stack_offset=(0, 0.52, 0), stack_floor_z=-0.55)
    pch = P.office_chair('printer_chair', None, slot(k), 0.0)
    pr.feed(4, 20)
    pr.led_pulse(1, 60)
    add('printer', [pch] + all_children(pr.root), view=(0.9, 1.0, 0.55), frame=13, size=(1.2, 1.3))
    k += 1
    # 6 droid + trolley + binder
    d = P.paper_droid('droid', None, tuple(slot(k)), 0.0)
    add('droid_trolley', all_children(d.root) + all_children(d.trolley) + [d.bar], view=(1.0, 0.7, 0.45),
        size=(1.7, 0.9))
    k += 1
    # 7 hero padlock (macro)
    pl = P.padlock('padlock', None, slot(k))
    add('padlock', all_children(pl), view=(-0.6, -1.0, 0.35), lens=85, fill=0.6)
    k += 1
    # 8 glass zero
    gz = P.glass_zero('glass_zero', None, slot(k))
    add('glass_zero', [gz], view=(-0.5, -1.0, 0.6), lens=85, fill=0.65)
    k += 1
    # 9 envelope
    ev = P.envelope('envelope', None, slot(k))
    add('envelope', all_children(ev), view=(-0.3, -1.0, 0.9), lens=85, fill=0.7)
    k += 1
    # 10 tabs
    tb = P.tab_stack('tabs', None, slot(k))
    add('tabs', all_children(tb), view=(-0.4, -1.0, 0.75), lens=85, fill=0.6)
    k += 1
    # 11 binder
    bd = P.binder('binder', None, slot(k), math.radians(20))
    add('binder', all_children(bd), view=(-0.6, -1.0, 0.6), lens=85, fill=0.7)
    k += 1
    # 12 hub
    hb = P.conference_hub('hub', None, tuple(slot(k)))
    add('hub', all_children(hb.root), view=(-0.4, -1.0, 0.7), lens=85, fill=0.7)
    k += 1
    # 13 the head of the table: socket, jack, master cord, hub (same layout as the room)
    import env_room as R
    base = slot(k)
    tz = R.ROOM['table_top_z']
    blk = P.box('walnut_block', (0.9, 0.6, 0.08), tuple(base + Vector((0.0, -0.3, tz - 0.04))), P.walnut(), None, 0.002)
    spos = base + Vector(R.ROOM['socket_pos'])
    sk = P.brass_socket('socket', None, tuple(spos))
    jk = P.gold_jack('jack', None, tuple(spos + Vector((0.0, P.SOCKET_FACE, 0.0))))
    hb2 = P.conference_hub('hub2', None, tuple(base + Vector(R.ROOM['hub_pos'])))
    bpy.context.view_layer.update()
    mc = P.master_cord(hb2.port, jk.root, jk.tail_local, R.master_cord_mids(R.ROOM['socket_pos'], tz, base), 'mcord')
    add('socket_jack', [blk, sk] + all_children(sk) + all_children(jk.root) + all_children(hb2.root) + [mc.obj],
        aim=base + Vector((0.12, -0.12, tz - 0.01)), view=(0.6, 1.0, 0.8), lens=60, fill=0.8, size=(0.5, 0.3))
    k += 1
    # 14 hero cup + lid + steam
    cp = P.cup_and_lid('cup', None, tuple(slot(k)))
    st = P.steam_cards('steam', None, tuple(slot(k) + Vector((0, 0, 0.13))))
    add('cup_lid', all_children(cp.root) + all_children(st), view=(-0.35, -0.6, 0.9), lens=85, fill=0.8,
        size=(0.16, 0.30))
    k += 1
    # 15 lid macro, top-down (the S02 opening)
    cp2 = P.cup_and_lid('cup2', None, tuple(slot(k)))
    sc_ = P.CUP['slot_r']
    add('lid_macro', all_children(cp2.root), aim=slot(k) + Vector((0, sc_, 0.131)), view=(0.0, -0.22, 1.0), lens=100,
        fill=1.0, size=(0.075, 0.05))
    k += 1
    # 16 a coil sample (cord over a walnut edge)
    base = slot(k)
    blk2 = P.box('walnut_block2', (0.4, 0.4, 0.08), tuple(base + Vector((0.0, 0.0, 0.71))), P.walnut(), None, 0.002)
    pts = [base + Vector(v) for v in ((0.25, 0.0, 0.6), (0.21, 0.02, 0.62), (0.205, 0.03, 0.756), (0.15, 0.06, 0.7555),
                                      (0.0, 0.16, 0.7555), (-0.15, 0.2, 0.7555))]
    cd = P.build_coil(pts, 'coil_demo')
    add('coil', [blk2, cd], aim=base + Vector((0.1, 0.08, 0.75)), view=(0.5, -1.0, 0.6), lens=85, fill=0.5,
        size=(0.3, 0.2))
    k += 1

    out_dir = os.path.join(os.path.abspath(a.out), 'props_tiles')
    os.makedirs(out_dir, exist_ok=True)
    # visibility: everything hidden except the current tile's objects
    every = [o for o in sc.objects if o.type in ('MESH', 'CURVE', 'EMPTY', 'LIGHT') and not o.name.startswith('st_')
             and o.name not in ('studio_rig', 'studio_sweep')]
    paths = []
    total = 0.0
    want = [t for t in a.tiles.split(',') if t]
    for i, tl in enumerate(tiles):
        if want and tl['name'] not in want:
            continue
        mine = set(o.name for o in tl['objs'])
        for o in every:
            o.hide_render = o.name not in mine
        sc.frame_set(tl['frame'])
        lo, hi = bbox_world(tl['objs'])
        if tl['size']:
            dx, dz = tl['size']
        else:
            dx, dz = max(hi.x - lo.x, hi.y - lo.y), hi.z - lo.z
        size = max(dx, dz * 1.4, 0.03)
        ctr = (lo + hi) / 2 if tl['aim'].length == 0 else tl['aim']
        v = tl['view'].normalized()
        phi = math.atan2(v.x, -v.y)
        rig.rotation_euler = (0, 0, phi)
        back = Vector((-math.sin(phi), math.cos(phi), 0.0))
        rig.location = (ctr.x + back.x * size * 0.25, ctr.y + back.y * size * 0.25, lo.z)
        rig.scale = (size, size, size)
        for l, e in zip(lights, base_e):
            l.data.energy = e * size * size
        cam = C.camera(f'cam_{tl["name"]}', tl['lens'])
        fov = 2 * math.atan(18.0 / tl['lens'])
        dist = (size / tl['fill']) / (2 * math.tan(fov / 2)) * 1.05
        v = tl['view'].normalized()
        cam.location = ctr + v * dist
        cam.data.clip_start = dist * 0.02
        C.look_at(cam, ctr)
        sc.camera = cam
        path = os.path.join(out_dir, f'{i:02d}_{tl["name"]}.png')
        total += render_to(path, 'tile_' + tl['name'])
        paths.append(path)
    print(f'TIME props_sheet_total {total:.1f}', flush=True)
    if not want:
        stitch(paths, os.path.join(os.path.abspath(a.out), 'props_sheet.png'), 4, tw, th)


def stitch(paths, out, cols, tw, th):
    import numpy as np
    rows = (len(paths) + cols - 1) // cols
    W, H = cols * tw, rows * th
    canvas = np.zeros((H, W, 4), dtype=np.float32)
    canvas[..., 3] = 1.0
    for i, pth in enumerate(paths):
        img = bpy.data.images.load(pth)
        px = np.array(img.pixels[:], dtype=np.float32).reshape(img.size[1], img.size[0], 4)
        r, c = divmod(i, cols)
        y0 = H - (r + 1) * th
        canvas[y0:y0 + th, c * tw:(c + 1) * tw, :] = px[:th, :tw, :]
        bpy.data.images.remove(img)
    im = bpy.data.images.new('sheet', W, H, alpha=False)
    im.pixels = canvas.ravel()
    im.filepath_raw = out
    im.file_format = 'PNG'
    im.save()
    print('SHEET', out, flush=True)


# ================================================================== room framings


def check_set_state(R):
    """Regression check: a later set_state must not turn an earlier fade into a hard switch."""
    import bpy as _b
    room = R.Room()
    ld = _b.data.lights.new('_chk_fill', 'AREA')
    lo = _b.data.objects.new('_chk_fill', ld)
    _b.context.scene.collection.objects.link(lo)
    ld.energy = 10.0
    room.fills = [(lo, 10.0)]
    m = _b.data.materials.new('_chk_mat')
    m.use_nodes = True
    mth = m.node_tree.nodes.new('ShaderNodeMath')
    room.diffuser_strength = mth.inputs[1]
    room.set_state(1, 'dark')
    room.set_state(1160, 'lit', ramp=12)
    room.set_state(1250, 'dark')
    fc = ld.animation_data.action
    from common import fcurves
    curve = [c for c in fcurves(fc) if c.data_path == 'energy'][0]
    vals = {f: curve.evaluate(f) for f in (1100, 1159, 1166, 1171, 1172, 1249, 1250)}
    ok = abs(vals[1166] - 5.2) < 0.3 and abs(vals[1159] - 0.4) < 1e-3 and abs(vals[1249] - 10.0) < 1e-3 \
        and abs(vals[1250] - 0.4) < 1e-3
    print('CHECK set_state', 'PASS' if ok else 'FAIL', {k: round(v, 3) for k, v in vals.items()}, flush=True)
    _b.data.objects.remove(lo)
    _b.data.lights.remove(ld)
    _b.data.materials.remove(m)
    return ok


def check_s11(R, room, cam, label):
    """Projection and occlusion check for the S11 framings: each shutdown screen and Pat's
    must project inside the frame and clear of Synergy, both an analytic 0.75 m silhouette
    (shoulders 0.75 m wide to 1.45 m, head 0.45 m wide to 1.80 m, 0.30 m deep) and the stand-in
    (scene ray cast). Prints one line per screen and PASS/FAIL."""
    from bpy_extras.object_utils import world_to_camera_view
    sc = bpy.context.scene
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    loc = cam.matrix_world.translation
    sp = Vector(R.SYNERGY_POS)
    boxes = [((sp.x - 0.375, sp.y - 0.15, 0.0), (sp.x + 0.375, sp.y + 0.15, 1.45)),
             ((sp.x - 0.225, sp.y - 0.15, 1.45), (sp.x + 0.225, sp.y + 0.15, 1.80))]

    def hits_box(p0, p1, lo, hi):
        d = p1 - p0
        t0, t1 = 0.0, 1.0
        for k in range(3):
            if abs(d[k]) < 1e-12:
                if p0[k] < lo[k] or p0[k] > hi[k]:
                    return False
                continue
            a_, b_ = (lo[k] - p0[k]) / d[k], (hi[k] - p0[k]) / d[k]
            t0, t1 = max(t0, min(a_, b_)), min(t1, max(a_, b_))
            if t0 > t1:
                return False
        return True
    ok = True
    names = list(R.SHUTDOWN_ORDER) + ['pat']
    for nm in names:
        t = room.terminals[nm]
        worst = []
        for dx, dz in ((0.0, 0.0), (-0.13, 0.09), (0.13, 0.09), (-0.13, -0.09), (0.13, -0.09)):
            p = t.to_world((dx, R.P.CRT['front'] - 0.005, R.P.CRT['zs'] + dz))
            uv = world_to_camera_view(sc, cam, p)
            inside = 0.0 <= uv.x <= 1.0 and 0.0 <= uv.y <= 1.0 and uv.z > 0
            occl = any(hits_box(loc, p, lo, hi) for lo, hi in boxes)
            d = (p - loc)
            hit, hp, _, _, ob, _ = sc.ray_cast(dg, loc, d.normalized(), distance=d.length - 0.02)
            stand = bool(hit and ob is not None and (ob.name.startswith('ph_') or ob.name.startswith('synergy')))
            worst.append((inside, occl, stand, uv))
        c_in, c_occ, c_st, uv = worst[0]
        good = all(w[0] for w in worst) and not any(w[1] or w[2] for w in worst)
        ok &= good
        print(f'CHECK {label} {nm:10s} u={uv.x:.3f} v={uv.y:.3f} in_frame={all(w[0] for w in worst)} '
              f'silhouette={any(w[1] for w in worst)} stand_in={any(w[2] for w in worst)} '
              f'{"ok" if good else "BLOCKED"}', flush=True)
    print(f'CHECK {label} projection/occlusion', 'PASS' if ok else 'FAIL', flush=True)
    return ok


def room_framings(a, names):
    import env_room as R
    sc = C.new_scene(1, 1440, a.quality, a.samples, threads=a.threads)
    if a.res_scale != 1.0:
        sc.render.resolution_x = int(sc.render.resolution_x * a.res_scale)
        sc.render.resolution_y = int(sc.render.resolution_y * a.res_scale)
    check_set_state(R)
    c0 = cpu_seconds()
    room = R.build(placeholder=True)
    R.demo_timeline(room)
    print(f'TIME build cpu={cpu_seconds() - c0:.1f}', flush=True)
    if a.save_blend:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(a.save_blend))
    times = {}
    for nm in names:
        f, cam = R.preview_camera(room, nm)
        kind = R.PREVIEW_BUDGET.get(nm, 'macro' if nm.startswith('macro_') else 'wide')
        if not a.no_budget:
            room.render_budget(kind=kind, samples=a.samples or None,
                               tier=None if a.res_scale == 1.0 else a.quality, locked=nm in R.PREVIEW_LOCKED)
        # macro inserts: the glare starts higher, so sunlit paper and brass keep their detail
        # (the defocused screens behind still bloom)
        room.compositor(threshold=1.6 if kind == 'macro' else 0.9)
        sc.view_settings.exposure = R.PREVIEW_EXPOSURE.get(nm, 0.0)
        sc.camera = cam
        frames = [int(x) for x in a.frames.split(',') if x] or [f]
        for fr in frames:
            sc.frame_set(fr)
            if nm.startswith('s11'):
                check_s11(R, room, cam, f'{nm}@{fr}')
            room.tune_scanlines(cam)
            c1 = cpu_seconds()
            out = f'{nm}.png' if not a.frames else f'{nm}_f{fr:04d}.png'
            l0 = load()
            wall = render_to(os.path.join(os.path.abspath(a.out), out), f'{nm}@{fr}')
            times[f'{nm}@{fr}'] = (wall, cpu_seconds() - c1, l0, load())
    print('COST (render only: wall-clock s, CPU-s of this process, 1-min load average before -> after)', flush=True)
    for nm, (wall, cpu, l0, l1) in times.items():
        print(f'COST {nm:22s} wall={wall:6.1f}s cpu={cpu:7.1f}s load={l0:5.2f}->{l1:5.2f}', flush=True)
    return times


def main():
    a = args()
    os.makedirs(a.out, exist_ok=True)
    names = [n for n in (a.only.split(',') if a.only else ALL) if n]
    room = [n for n in names if n != 'props_sheet']
    if room:
        room_framings(a, room)
    if 'props_sheet' in names:
        props_sheet(a)


if __name__ == '__main__':
    main()
