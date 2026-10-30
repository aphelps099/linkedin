"""Synergy judged under the film's own light: the Long Room (env_room, read-only) with the
real rig at env_room.SYNERGY_POS, rendered at the treatment framings.

    blender -b --factory-startup -P tools/synergy_in_room.py -- --out DIR
        [--only s02_end,s05_medium,s13_sip] [--all] [--quality proof] [--res 640x360] [--samples 16]
        [--no-rim] [--no-render] [--report] [--report-only]

Default framings (the three a round must pass):
  s02_end     S02 final frame (f236): 2.1 m in front at screen height 1.58 m, 10 deg toward his
              right, aimed at 1.32 m with a 48 mm lens so the head sits in the upper third, the
              cup in the lower-left third and the badge lower centre (the treatment's 65 mm cannot
              hold all three from 2.1 m: 65 mm would need 2.9 m); lit room, idle cup, 4 deg roll
  s05_medium  S05 (f452): 85 mm medium shot, 2.6 m, 1.58 m, 10 deg to his right, f/4.5 focused
              between the padlock and the screen (both hold within ~1 px at proof size); head rolled
              to 8 and pitched 3 to study the hero padlock pinched (thumb / index + middle) at chin
              level 35 cm in front of the screen, the hand rolled so the padlock's broad face turns
              ~30 deg toward the camera with the shackle clear of the fingers
  s13_sip     S13 (f1300): 65 mm MCU from 1.35 m, 1.9 m away, 8 deg to his right; dark room,
              headset off on the walnut, the sip (rig.sip(1249): spout at the chin plate on
              f1297), mouth filling, eyes closed to the bottom row
--all adds s05_study (85 mm at 1.3 m), s07_34 (35 mm 3/4 while posting) and s11_dip (32 mm
from behind-left, dark, the one head dip).

Light: the room exactly as env_room builds it, plus (unless --no-rim) two proposed additions
for the director and env_room: a soft cool backlight high behind the host (the skylight's
spill off the head wall), so the headband and the faceted crown separate from the black wall,
and the treatment's warm walnut bounce from the table in front of him (lower torso, arms, the
face of a held padlock); both invisible to camera. --samples is honoured (the room's render budget is applied first, then
the sample count is set; Synergy close-ups want >= 16-24).

Every frame is rendered one at a time. After each render the script prints colour samples at
projected 3D points (cream, grey, glass, eyes and idle mouth dots). With --report (or
--report-only; ~40 s, so it is off by default when rendering) it prints a BVH overlap report for
the action targets as the shots will use them: S04 index on the walnut (rig.reach_L at
env_room's fingertip_L contract), S05 padlock at the chin, the S05/S07 posting line (rig.post:
every frame straight down the slot axis) for the envelope AND for the padlock (gap 30 mm,
extent: the padlock mesh rides in the hand; pairs between hand, padlock and cup f500-514 and the
padlock's lowest point above the slot at contact), S10 jack (rig.lean(keep_cup=True) + world
target, with the cup's drift), S11 headband grip + the unplug lift (cord vertices inside the
head, f1129-1140) and the S13 lift (rig.sip, every 3rd frame f1249-1300, with the cup tilt).
"""

import argparse
import colorsys
import math
import os
import sys
import time

import bpy
from mathutils import Matrix, Vector
from bpy_extras.object_utils import world_to_camera_view

LIB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'lib')
sys.path.insert(0, LIB)

import common as C  # noqa: E402
import env_room as R  # noqa: E402
import face as F  # noqa: E402
import materials as M  # noqa: E402
import props as PR  # noqa: E402
import synergy as S  # noqa: E402

DEFAULT = ('s02_end', 's05_medium', 's13_sip')
EXTRA = ('s05_study', 's07_34', 's11_dip')
PADLOCK_GAP = 0.030            # the padlock body is 30 mm thick between thumb and index/middle


def args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument('--out', required=True)
    p.add_argument('--only', default='')
    p.add_argument('--all', action='store_true')
    p.add_argument('--quality', default='proof', choices=sorted(C.QUALITY))
    p.add_argument('--res', default='640x360')
    p.add_argument('--samples', type=int, default=16)
    p.add_argument('--no-rim', action='store_true', help='the room exactly as env_room lights it (no proposals)')
    p.add_argument('--no-render', action='store_true')
    p.add_argument('--report', action='store_true', help='also print the overlap report (~40 s)')
    p.add_argument('--report-only', action='store_true', help='overlap report only, no renders')
    p.add_argument('--save-blend', default='')
    return p.parse_args(argv)


# ------------------------------------------------------------------ performance used by the framings

def face_timeline():
    tl = F.FaceTimeline(1, 1440)
    tl.blink(240)                                   # S02 slow blink
    tl.wave(461, end=497)                           # S05 'Outstanding.', back to idle on f497
    tl.stall(885, stop_led=9, hold=15, fade=8, stop_frame=897)    # S09 the praise stalls at LED 9
    tl.blink(917)
    tl.fill(1297, step=1.45, level=0.7)             # S13 progress-bar mouth
    tl.eyes_rows(1299, 1336, 'bottom')
    return tl


def bounce_light(coll):
    """Proposed walnut bounce (treatment S02/S05: 'warm bounce from the walnut below'): the
    skylight slab's warm reflection off the table in front of him, lifting the lower torso, the
    arms and the front of a held padlock. Invisible to camera and to glossy rays."""
    sp = Vector(R.SYNERGY_POS)
    lt = C.area_light('syn_bounce_proposal', (sp.x, sp.y - 0.80, R.TABLE_TOP + 0.02), (sp.x, sp.y - 0.05, 1.22),
                      9.0, 1.1, 0.5, color=(1.0, 0.84, 0.70), coll=coll)
    lt.visible_camera = False
    lt.visible_glossy = False
    return lt


def rim_light(coll):
    """Proposed backlight: the skylight slab's spill off the head wall, high behind the host."""
    sp = Vector(R.SYNERGY_POS)
    lt = C.area_light('syn_rim_proposal', (sp.x + 0.35, sp.y + 1.05, 2.55), (sp.x, sp.y, 1.55), 55.0, 0.9, 0.35,
                      color=(0.86, 0.91, 1.0), coll=coll)
    lt.visible_camera = False
    return lt


def _world_mesh(objs, dg):
    """(verts, polys) of evaluated mesh objects merged, in world space."""
    vs, ps = [], []
    for o in objs:
        if o.type != 'MESH':
            continue
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        Mw = ev.matrix_world
        k = len(vs)
        vs += [Mw @ v.co for v in me.vertices]
        ps += [tuple(i + k for i in p.vertices) for p in me.polygons]
        ev.to_mesh_clear()
    return vs, ps


def fit_padlock(rig, pad, f, gap=PADLOCK_GAP, slot=None):
    """World matrix for the padlock pinched in the left hand at frame f with no part of it inside
    the hand: its broad faces on the thumb and index pads (thickness across the pinch), searched
    over the turn about the pinch axis and where on the face the pads land; prefers the shackle
    up and the body out beyond the fingertips. Returns (matrix, overlap pairs)."""
    from mathutils.bvhtree import BVHTree
    pin = rig.thumb_pinch('L', gap=gap)
    sc = bpy.context.scene
    sc.frame_set(f)
    dg = bpy.context.evaluated_depsgraph_get()
    ae = rig.arm.evaluated_get(dg)
    D = ae.matrix_world @ ae.pose.bones['hand_L'].matrix @ rig._rest['hand_L'].inverted()
    hd = rig.hands['L']
    hand = rig.parts_on_bones(['hand_L'] + [f'{n}_{i}_L' for n in ('index', 'middle', 'ring', 'pinky') for i in (1, 2, 3)] +
                              [f'thumb_{i}_L' for i in range(3)])
    hv, hp = _world_mesh(hand, dg)
    th = BVHTree.FromPolygons(hv, hp)
    # padlock mesh in its own (root) space
    con = pad.constraints.get('in_hand')
    if con is not None:
        con.influence = 0.0
    pad.matrix_world = Matrix.Identity(4)
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    lv, lp = _world_mesh([o for o in pad.children_recursive], dg)
    across = (D.to_3x3() @ (pin['thumb_tip'] - pin['tip'])).normalized()
    u_w = (D.to_3x3() @ hd['u']).normalized()
    up0 = (u_w - across * u_w.dot(across)).normalized()
    c = D @ pin['point']
    best = None
    for phi in range(0, 360, 15):
        up = Matrix.Rotation(math.radians(phi), 3, across) @ up0
        x = across.cross(up)
        Rm = Matrix((x, across, up)).transposed().to_4x4()
        for qx in (-0.020, -0.012, -0.004, 0.004, 0.012, 0.020):
            for qz in (0.008, 0.016, 0.024, 0.032, 0.040, 0.047):
                Mp = Matrix.Translation(c) @ Rm @ Matrix.Translation((-qx, 0.0, -qz))
                tv = [Mp @ v for v in lv]
                n = len(th.overlap(BVHTree.FromPolygons(tv, lp)))
                body_c = Mp @ Vector((0, 0, 0.026))
                if slot is not None:
                    low = min((v - slot[0]).dot(slot[1]) for v in tv)
                    score = n * 100.0 + 20.0 * max(low, 0.0) + 2000.0 * max(0.0, 0.002 - low) - 0.2 * up.z
                else:
                    score = n * 100.0 - 0.6 * up.z - 4.0 * (body_c - c).dot(u_w)
                if best is None or score < best[0]:
                    best = (score, Mp, n)
    return best[1], best[2]


def hold_padlock(rig, f, gap=PADLOCK_GAP, pad=None, follow=False, slot=None):
    """The hero padlock pinched in the left hand at frame f (fit_padlock: no part of it inside
    the fingers). follow=True keeps it in the hand (Child Of hand_L) instead of a static world
    placement. Returns the padlock root (its 'hand_pairs' property: overlaps left after the fit)."""
    if pad is None:
        pad = PR.padlock('syn_padlock', C.collection('Synergy_props'), (0, 0, 0), 0.0, hero=True)
    Mp, n = fit_padlock(rig, pad, f, gap, slot)
    pad['hand_pairs'] = n
    if follow:
        sc = bpy.context.scene
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        ae = rig.arm.evaluated_get(dg)
        Th = ae.matrix_world @ ae.pose.bones['hand_L'].matrix
        con = pad.constraints.get('in_hand') or pad.constraints.new('CHILD_OF')
        con.name = 'in_hand'
        con.influence = 1.0
        con.target = rig.arm
        con.subtarget = 'hand_L'
        con.inverse_matrix = Th.inverted()
        pad.matrix_basis = Mp
    else:
        pad.matrix_world = Mp
    return pad


def padlock_reach(rig, pad, frame, pos, ax):
    """Lowest point of the padlock along the slot axis, relative to the slot plane (metres)."""
    bpy.context.scene.frame_set(frame)
    dg = bpy.context.evaluated_depsgraph_get()
    low = 9.0
    for o in [pad] + list(pad.children_recursive):
        if o.type != 'MESH':
            continue
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        Mw = ev.matrix_world
        low = min(low, min((Mw @ v.co - pos).dot(ax) for v in me.vertices))
        ev.to_mesh_clear()
    return low


def study_hand(rig, cam_pos, f, face_deg=30.0):
    """S05 study pose: wrist frame (u along the fingers, w palm normal) for the padlock pinch at
    the chin, searched over small turns of the fingers' direction and the roll about it so a
    broad face of the padlock turns ~face_deg toward the camera (tipped up toward the skylight),
    in front of the hand. Returns (u, w, face angle to the camera, (yaw, pitch, roll))."""
    hd = rig.hands['L']
    u0 = S.V((-0.45, -0.70, 0.55)).normalized()
    w0 = S.V((-0.60, 0.70, 0.40))
    w0 = (w0 - u0 * w0.dot(u0)).normalized()
    pin = rig.thumb_pinch('L', gap=PADLOCK_GAP)
    target = S.V((0.02, -0.50, 1.42))
    to_cam = (S.V(cam_pos) - target).normalized()
    # the face turns face_deg toward the camera, tipped UP toward the overhead skylight, so the
    # polished brass mirrors the slab (one glint) instead of the black room
    up_p = (S.UP - to_cam * S.UP.dot(to_cam)).normalized()
    want = (to_cam * math.cos(math.radians(face_deg)) + up_p * math.sin(math.radians(face_deg))).normalized()
    best = None
    for yaw in (-60, -45, -30, -15, 0, 15):
        for pitch in (-20, 0, 20, 35):
            Ry = Matrix.Rotation(math.radians(yaw), 3, 'Z') @ Matrix.Rotation(math.radians(pitch), 3, u0.cross(S.UP).normalized())
            u = (Ry @ u0).normalized()
            wb = Ry @ w0
            wb = (wb - u * wb.dot(u)).normalized()
            for a in range(-90, 91, 15):
                w = Matrix.Rotation(math.radians(a), 3, u) @ wb
                Rt = S.frame3(u, w) @ S.frame3(hd['u'], hd['w']).transposed()
                across = (Rt @ (pin['thumb_tip'] - pin['tip'])).normalized()
                ang = min(math.degrees(across.angle(want)), math.degrees((-across).angle(want)))
                # the padlock (at the pinch) must sit in front of the hand, not behind its back plate
                front = (Rt @ (pin['point'] - (hd['W'] + hd['u'] * 0.05 - hd['w'] * 0.012))).dot(to_cam)
                score = ang + (abs(a) + abs(yaw) + abs(pitch)) * 0.08 + max(0.0, 0.03 - front) * 2000.0
                if best is None or score < best[0]:
                    cam_ang = min(math.degrees(across.angle(to_cam)), math.degrees((-across).angle(to_cam)))
                    best = (score, u, w, cam_ang, (yaw, pitch, a))
    return best[1], best[2], best[3], best[4]


def stage(rig, room):
    sp = Vector(R.SYNERGY_POS)
    k = 'CONSTANT'

    def base(f, preset='idle_cup', **pose):
        rig.rest(f, k)
        rig.apply_preset(f, preset, k)
        rig.pose(f, k, root_loc=tuple(sp), root_rot=0.0, **pose)

    def around(dist, deg, h):
        a = math.radians(-deg)      # positive deg = toward his right (-X)
        return (sp.x + dist * math.sin(a), sp.y - dist * math.cos(a), h)

    # S02 end: idle, canon head, faint breathing (chest plates only)
    base(236)
    rig.breathe(129, 256)
    # S05 study: padlock at chin level, 35 cm in front of the screen, head roll 8 / pitch 3; the
    # hand rolled so the padlock's broad face turns ~30 deg toward the S05 camera
    cam05 = Vector(around(2.6, 10, 1.58)) - sp
    u, w, face_ang, turn = study_hand(rig, cam05, 452)
    print(f'S05 padlock face {face_ang:.0f} deg to camera (hand yaw/pitch/roll {turn})', flush=True)
    for f in (452, 453):
        base(f, head=(3.0, 8.0, 0.0))
        hd = rig.hands['L']
        Rt = S.frame3(u, w) @ S.frame3(hd['u'], hd['w']).transposed()
        wrist = S.V((0.02, -0.50, 1.42)) - Rt @ (rig.thumb_pinch('L', gap=PADLOCK_GAP)['point'] - hd['W'])
        rig.place_arm_clear(f, 'L', wrist, u, w, S.V((0.8, -0.3, -0.5)), interp=k, fingers='pinch')
        rig.pose(f, k, fingers_L=S.PADLOCK_FINGERS, thumb_L=('pinch', PADLOCK_GAP))
    pad = hold_padlock(rig, 452)
    print(f'S05 padlock in hand: {pad["hand_pairs"]} pairs with the fingers', flush=True)
    # S07: posting (contact frame), head and torso still
    for f in range(640, 660):
        base(f)
    rig.post(650)
    # S11: the head dip (dark), the headset still on (he lifts it off from f1129, after the dip)
    base(1114, head=(8.0, 4.0, -6.0))
    # S13: the whole sip, on its beats (spout on the chin plate at f1297), held to the cut
    base(1240)
    for f in range(1241, 1310):
        rig.pose(f, k, root_loc=tuple(sp), root_rot=0.0)
    contact = rig.sip(1249)
    rig.sip_stage(contact + 8, 3, k)
    # headset: lifted off at f1129, on the walnut beside the hub from f1150
    hs = rig.headset
    if hs is not None:
        rig.detach_headset(1129)
        bpy.context.scene.frame_set(1129)
        place = Matrix.Rotation(math.radians(-90), 4, 'Y')
        hs.rotation_mode = 'QUATERNION'
        hs.location = (0.34, -0.12, 0.9)
        hs.rotation_quaternion = place.to_quaternion()
        hs.keyframe_insert('location', frame=1150)
        hs.keyframe_insert('rotation_quaternion', frame=1150)
        bpy.context.scene.frame_set(1150)
        dg = bpy.context.evaluated_depsgraph_get()
        zmin = 9.0
        for o in hs.children_recursive:
            if o.type != 'MESH':
                continue
            ev = o.evaluated_get(dg)
            zmin = min(zmin, min((ev.matrix_world @ Vector(c)).z for c in ev.bound_box))
        hs.location.z += R.TABLE_TOP + 0.0005 - zmin
        hs.keyframe_insert('location', frame=1150)
    # the padlock only exists in S05
    for f, hide in ((1, True), (451, False), (454, True)):
        for o in [pad] + list(pad.children_recursive):
            o.hide_render = hide
            o.keyframe_insert('hide_render', frame=f)
    # cameras
    cams = {}

    def cam(name, f, lens, loc, target, fstop, focus):
        c = C.camera('cam_' + name, lens, loc, target, fstop=fstop, focus=focus, clip=(0.01, 200.0))
        cams[name] = (f, c)

    cam('s02_end', 236, 48.0, around(2.1, 10, 1.58), (sp.x - 0.02, sp.y, 1.32), 2.8, 2.1)
    # f/4.5, focus split between the padlock (~2.25 m) and the screen (~2.6 m): both within ~1 px
    cam('s05_medium', 452, 85.0, around(2.6, 10, 1.58), (sp.x, sp.y, 1.45), 4.5, 2.42)
    cam('s05_study', 453, 85.0, around(1.3, 16, 1.52), (sp.x - 0.02, sp.y, 1.50), 2.8, 1.3)
    cam('s13_sip', 1300, 65.0, around(1.9, 8, 1.35), (sp.x, sp.y - 0.05, 1.40), 2.8, 1.9)
    # S07: beside the head of the table on his right, at 1.55 m; he stands at frame right in 3/4
    # (face ~50 deg to camera), the walnut receding frame-left
    cam('s07_34', 650, 35.0, (sp.x - 1.45, sp.y - 1.25, 1.55), (sp.x - 0.30, sp.y - 0.55, 1.28), 8.0, 1.9)
    for name, (f, c) in list(cams.items()):
        rig.glass_glint(c, f)               # the reflected skylight slot along the glass's top edge
    cam('s11_dip', 1114, 32.0, (sp.x - 0.5, sp.y + 1.4, 1.5), (sp.x - 0.5, -30.0, 1.5 - 30.0 * math.tan(math.radians(2))),
        5.6, 1.5)
    return cams


# ------------------------------------------------------------------ measurement

def load_pixels(path):
    img = bpy.data.images.load(path, check_existing=False)
    w, h = img.size
    px = list(img.pixels[:])
    bpy.data.images.remove(img)
    return w, h, px


def srgb_hex(c):
    return '#%02X%02X%02X' % tuple(int(round(max(0.0, min(1.0, v)) * 255)) for v in c)


def sample(path, pts, cam, radius=2):
    """Median colour in a small box around each projected world point. pts: {label: Vector}."""
    sc = bpy.context.scene
    w, h, px = load_pixels(path)
    out = {}
    for label, p in pts.items():
        co = world_to_camera_view(sc, cam, p)
        if not (0 <= co.x <= 1 and 0 <= co.y <= 1 and co.z > 0):
            continue
        cx, cy = int(co.x * w), int(co.y * h)
        cols = []
        for y in range(max(0, cy - radius), min(h, cy + radius + 1)):
            for x in range(max(0, cx - radius), min(w, cx + radius + 1)):
                i = (y * w + x) * 4
                cols.append(px[i:i + 3])
        if not cols:
            continue
        med = [sorted(c[k] for c in cols)[len(cols) // 2] for k in range(3)]
        mx = max(cols, key=lambda c: 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2])
        out[label] = (med, mx)
    return out


def report_colours(name, path, rig, cam, f):
    sc = bpy.context.scene
    sc.frame_set(f)
    dg = bpy.context.evaluated_depsgraph_get()

    def centre(key):
        o = rig.parts.get(key)
        if o is None:
            return None
        ev = o.evaluated_get(dg)
        bb = [ev.matrix_world @ Vector(c) for c in ev.bound_box]
        return sum(bb, Vector()) / 8.0

    pts = {}
    for key, label in (('torso_f_v', 'cream_torso_v'), ('torso_f_collar_r', 'cream_torso_r'),
                       ('torso_f_chip', 'cream_chip_plate'), ('head_crown_c', 'cream_crown'),
                       ('torso_f_outer_l', 'cream_outer_l'), ('torso_f_bot_l', 'cream_bot_l'),
                       ('torso_f_chip_in', 'cream_chip_in'), ('torso_f_mid_r', 'cream_mid_r'),
                       ('torso_f_grey_big', 'grey_torso_big'), ('torso_f_grey_r', 'grey_torso_r'),
                       ('head_cheek_grey', 'grey_head_cheek'), ('head_crown_band', 'grey_crown_band')):
        p = plate_point(rig, key, dg, cam)
        if p is not None:
            pts[label] = p
    if rig.parts.get('blue_chip') is not None:
        pts['blue_chip'] = centre('blue_chip')
    pb = bpy.data.objects.get('syn_padlock_body')
    if pb is not None and not pb.hide_render:
        ev = pb.evaluated_get(dg)
        bb = [ev.matrix_world @ Vector(c) for c in ev.bound_box]
        pts['padlock_body'] = sum(bb, Vector()) / 8.0
    pts['glass'] = rig.screen_point(0.5, 0.45)
    pts['glass_top'] = rig.screen_point(0.5, 0.88)
    pts['eye_L'] = rig.screen_point(6.0 / 22, 1 - 6.5 / 16)
    pts['eye_R'] = rig.screen_point(16.0 / 22, 1 - 6.5 / 16)
    for i in (4, 10, 16):
        pts[f'mouth_{i}'] = rig.screen_point(F.MOUTH_U[0] + (i + 0.5) * (F.MOUTH_U[1] - F.MOUTH_U[0]) / 22, F.MOUTH_V)
    res = sample(path, pts, cam)
    lum = lambda c: 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
    print(f'COLOURS {name} (frame {f})', flush=True)
    for label, (med, mx) in res.items():
        h_, l_, s_ = colorsys.rgb_to_hls(*[max(0.0, min(1.0, v)) for v in med])
        print(f'    {label:18s} med {srgb_hex(med)}  H{h_ * 360:4.0f} L{l_:.2f} S{s_:.2f}   peak {srgb_hex(mx)}',
              flush=True)
    eyes = [lum(res[k][1]) for k in ('eye_L', 'eye_R') if k in res]
    mouth = [lum(res[k][1]) for k in res if k.startswith('mouth_')]
    if eyes and mouth:
        print(f'    mouth/eye peak luminance ratio {max(mouth) / max(1e-6, max(eyes)):.2f}', flush=True)
    L_ = lambda k: colorsys.rgb_to_hls(*[max(0.0, min(1.0, v)) for v in res[k][0]])[1]
    for g_, adj in (('grey_torso_big', ('cream_outer_l', 'cream_bot_l', 'cream_chip_in')),
                    ('grey_torso_r', ('cream_mid_r', 'cream_torso_r'))):
        cs = [L_(k) for k in adj if k in res]
        if g_ in res and cs:
            print(f'    {g_} / adjacent cream L ratio {L_(g_) / max(1e-6, max(cs)):.2f} (grey L{L_(g_):.2f}, '
                  f'brightest adjacent cream L{max(cs):.2f})', flush=True)


def plate_point(rig, key, dg, cam=None):
    """World point on a plate's top face that the camera actually sees (a ray from the camera
    hits this plate first: not the lanyard, badge, cup or a hand), searched from the centroid of
    its largest triangle outward; without a camera, that centroid. Plates are built in rest space
    with their origin (object location) at their own centroid."""
    o = rig.parts.get(key)
    if o is None or 'plate_tris' not in o:
        return None
    flat = list(o['plate_tris'])
    tris = [[Vector(flat[i + 3 * j:i + 3 * j + 3]) for j in range(3)] for i in range(0, len(flat), 9)]
    tris.sort(key=lambda t: -(t[1] - t[0]).cross(t[2] - t[0]).length)
    ev = o.evaluated_get(dg)
    Mw = ev.matrix_world
    cands = []
    for t in tris[:3]:
        c = sum(t, Vector()) / 3.0
        nrm = (t[1] - t[0]).cross(t[2] - t[0]).normalized()
        for corner in [None] + list(t):
            for k in ((0.18,) if corner is None else (0.35, 0.6)):
                q = c + ((t[0] if corner is None else corner) - c) * k + nrm * 0.0003
                cands.append(Mw @ (q - Vector(o.location)))
    if cam is None:
        return cands[0]
    sc = bpy.context.scene
    org = cam.matrix_world.translation
    for p in cands:
        d = p - org
        hit, loc, nrm_, idx, hobj, _ = sc.ray_cast(dg, org, d.normalized(), distance=d.length + 0.002)
        if hit and hobj is not None and hobj.name == o.name and (loc - p).length < 0.004:
            return p
    return None


def _real(a, b):
    """Pairs that count as interpenetration (joint seats, pistons and cables excluded)."""
    import re
    if any(x in a or x in b for x in ('piston', 'rail', 'wire', 'cable', 'cord', 'plug', 'bicep', 'hamstring',
                                      'achilles')):
        return False
    ma = re.match(r'.*(index|middle|ring|pinky|thumb)_(\d)_([LR])$', a)
    mb = re.match(r'.*(index|middle|ring|pinky|thumb)_(\d)_([LR])$', b)
    if ma and mb and ma.group(1) == mb.group(1) and ma.group(3) == mb.group(3) and \
            abs(int(ma.group(2)) - int(mb.group(2))) == 1:
        return False
    for x, y in (('forearm_', 'upperarm_'), ('palm_', 'forearm_'), ('palm_', 'index_1'), ('palm_', 'middle_1'),
                 ('palm_', 'ring_1'), ('palm_', 'pinky_1'), ('palm_', 'thumb_0'), ('shoulder_hub', 'upperarm')):
        if ((x in a and y in b) or (x in b and y in a)) and a[-1] == b[-1]:
            return False
    return True


def cord_check(rig, sp, k, base, f=3200):
    """S11 unplug: grip the band at f, carry the headset 10 cm up and to his left by f + 11; the
    worst count of cord vertices inside the head hull (offset 4 mm) on f..f+11."""
    hull = rig._builder_hulls['head']
    for fr in range(f - 1, f + 13):
        base(fr)
    sol = rig.grip_headband(f, k)
    hd = rig.hands['L']
    lift = Vector((0.05, 0.0, 0.09))
    rig.place_arm(f + 11, 'L', sol['wrist'] + lift, sol['u'], sol['w'], sol['pole'], 'BEZIER', shoulder=sol['shoulder'])
    rig.pose(f + 11, 'BEZIER', fingers_L={nm: tuple(a * sol['curl'] * k_ for a in S.FIST)
                                          for nm, k_ in (('index', 0.9), ('middle', 1.0), ('ring', 1.05), ('pinky', 1.1))},
             thumb_L=sol['thumb'])
    rig.attach_headset(f, 'hand_L')
    cord = rig.parts.get('headset_cord')
    plug = rig.parts.get('headset_plug')
    worst, wf, plug_in = 0, 0, 0.0
    sc = bpy.context.scene
    for fr in range(f, f + 12):
        sc.frame_set(fr)
        dg = bpy.context.evaluated_depsgraph_get()
        Dh = (rig.arm.evaluated_get(dg).matrix_world @ rig.arm.evaluated_get(dg).pose.bones['head'].matrix @
              rig._rest['head'].inverted()).inverted()
        ev = cord.evaluated_get(dg)
        me = ev.to_mesh()
        n = sum(1 for v in me.vertices if hull.sdf(Dh @ (ev.matrix_world @ v.co)) < 0.0)
        ev.to_mesh_clear()
        if n > worst:
            worst, wf = n, fr - f
        pp = plug.evaluated_get(dg).matrix_world.translation
        plug_in = max(plug_in, -hull.sdf(Dh @ pp))
    # leave no trace: drop every key this check put on the headset, its cord hooks and the plug
    for o in [rig.headset] + list(rig.cord_hooks):
        ad = o.animation_data
        if ad is None or ad.action is None:
            continue
        for fc in list(C.fcurves(ad.action)):
            for kp in reversed(list(fc.keyframe_points)):
                if f - 2 <= kp.co.x <= f + 40:
                    fc.keyframe_points.remove(kp)
    rig.headset.constraints['on_head'].influence = 1.0
    rig.headset.constraints['in_hand_L'].influence = 0.0
    for e in rig.cord_hooks:
        for cn, v in (('worn', 1.0), ('route', 0.0), ('unplugged', 0.0)):
            if cn in e.constraints:
                e.constraints[cn].influence = v
    return worst, wf, plug_in


def overlap_check(rig, sp):
    """BVH overlaps (triangle pairs) of the arms at their action targets as the shots use them,
    joint seats, pistons and cables excluded."""
    k = 'CONSTANT'
    FING = ['index', 'middle', 'ring', 'pinky']
    arm_L = ['shoulder_L', 'pauldron_L', 'upperarm_L', 'forearm_L', 'hand_L'] + \
        [f'{n}_{i}_L' for n in FING for i in (1, 2, 3)] + [f'thumb_{i}_L' for i in range(3)]
    arm_R = [b.replace('_L', '_R') for b in arm_L]
    body = rig.parts_on_bones(['chest', 'neck', 'head', 'spine', 'pelvis', 'badge'] + arm_R)
    hs = [o for o in rig.headset.children_recursive if o.type == 'MESH'] if rig.headset else []
    cup = [o for o in rig.cup_objects() if o.type == 'MESH']

    def rep(f, a, b):
        r = rig.overlap_report(f, a, b)
        return {(x, y): n for (x, y), n in r.items() if _real(x, y)}

    def worst(r):
        return ', '.join(f'{a.split("_", 1)[1]}x{b.split("_", 1)[1]} {v}' for (a, b), v in
                         sorted(r.items(), key=lambda x: -x[1])[:3])
    print('OVERLAPS (triangle pairs; joint seats, pistons and cables excluded)', flush=True)
    t0 = time.time()

    def base(f):
        rig.rest(f, k)
        rig.apply_preset(f, 'idle_cup', k)
        rig.pose(f, k, root_loc=tuple(sp), root_rot=0.0)
    base(3000)
    print(f'    idle_cup baseline            {sum(rep(3000, rig.parts_on_bones(arm_L), body + hs + cup).values()):4d} pairs',
          flush=True)
    # S04: index tip on the walnut at env_room's contract (world)
    f = 3001
    base(f)
    tip = Vector(R.ROOM['fingertip_L'])
    sol = rig.reach_L(f, tip=tip, interp=k)
    r = rep(f, rig.parts_on_bones(arm_L), body + hs + cup)
    bpy.context.scene.frame_set(f)
    dg = bpy.context.evaluated_depsgraph_get()
    zmin = min(min((o.evaluated_get(dg).matrix_world @ v.co).z for v in o.data.vertices)
               for o in rig.parts_on_bones(['hand_L'] + [b for b in arm_L if b[:-2] in
                                                          [f'{n}_{i}' for n in FING + ['thumb'] for i in range(4)]])
               if o.type == 'MESH')
    ae = rig.arm.evaluated_get(dg)
    D = ae.matrix_world @ ae.pose.bones['hand_L'].matrix @ rig._rest['hand_L'].inverted()
    end = D @ rig.finger_points('L', 'index', (0, 0, 0))[-1]
    print(f'    S04 index tip on the walnut   {sum(r.values()):4d} pairs  tip error {(end - tip).length * 1000:4.1f} mm  '
          f'hand min z {zmin:.4f} (table {R.TABLE_TOP})  {worst(r)}', flush=True)
    # S05: padlock at the chin
    f = 3002
    base(f)
    hd = rig.hands['L']
    u, w = Vector((-0.45, -0.70, 0.55)).normalized(), Vector((-0.60, 0.70, 0.40))
    w = (w - u * w.dot(u)).normalized()
    Rt = S.frame3(u, w) @ S.frame3(hd['u'], hd['w']).transposed()
    wrist = Vector((0.02, -0.50, 1.42)) - Rt @ (rig.thumb_pinch('L', gap=PADLOCK_GAP)['point'] - hd['W'])
    sol = rig.place_arm_clear(f, 'L', wrist, u, w, Vector((0.8, -0.3, -0.5)), k, fingers='pinch')
    rig.pose(f, k, fingers_L='pinch', thumb_L=('pinch', PADLOCK_GAP))
    r = rep(f, rig.parts_on_bones(arm_L), body + hs + cup)
    print(f'    S05 padlock at the chin       {sum(r.values()):4d} pairs  reach miss {sol["reach"] * 1000:4.1f} mm  {worst(r)}',
          flush=True)
    # S10: jack at the socket, a 4 deg lean (the cup kept in place), world target
    f = 3004
    base(f)
    held = rig._cup_grip_world(f)
    rig.lean(f, 4.0, k, keep_cup=True)
    after = rig._cup_grip_world(f)
    drift = (after[0] - held[0]).length if held and after else float('nan')
    tilt = math.degrees(after[1].angle(held[1])) if held and after else float('nan')
    soc = Vector(R.SOCKET_POS)
    tgt = Vector((soc.x, soc.y + PR.SOCKET_FACE + 0.03, soc.z))
    u, w = Vector((0.0, -0.45, -0.89)).normalized(), Vector((-0.95, 0.20, -0.1))
    w = (w - u * w.dot(u)).normalized()
    pin = rig.thumb_pinch('L', gap=0.0)
    Dc = rig._chest_delta(f)
    uc, wc = (Dc.to_3x3() @ u).normalized(), (Dc.to_3x3() @ w).normalized()
    Rt = S.frame3(uc, wc) @ S.frame3(hd['u'], hd['w']).transposed()
    wrist = Dc @ tgt - Rt @ (pin['point'] - hd['W'])
    sol = rig.place_arm_clear(f, 'L', wrist, uc, wc, Vector((0.8, 0.2, -0.5)), k, fingers='pinch')
    rig.pose(f, k, fingers_L='pinch', thumb_L=('pinch', 0.0))
    r = rep(f, rig.parts_on_bones(arm_L), body + hs + cup)
    print(f'    S10 jack (4 deg lean)         {sum(r.values()):4d} pairs  reach miss {sol["reach"] * 1000:4.1f} mm  '
          f'cup drift {drift * 1000:.1f} mm / {tilt:.2f} deg  {worst(r)}', flush=True)
    # S11: headband grip, then the unplug lift (10 cm up and to his left by +11 frames)
    f = 3005
    base(f)
    sol = rig.grip_headband(f, k)
    r = rep(f, rig.parts_on_bones(arm_L), body + hs + cup)
    print(f'    S11 grip the headband         {sum(r.values()):4d} pairs  reach miss {sol["reach"] * 1000:4.1f} mm  {worst(r)}',
          flush=True)
    cord = cord_check(rig, sp, k, base)
    print(f'    S11 unplug lift f+0..f+11     cord vertices inside the head: max {cord[0]} (frame offset {cord[1]}), '
          f'plug inside: {cord[2] * 1000:.1f} mm max depth', flush=True)
    # S05/S07 posting: the straight line
    f = 3020
    for fr in range(f - 9, f + 8):
        base(fr)
    rig.post(f)
    pin = rig.thumb_pinch('L')
    off = 0.0
    pairs = 0
    for fr in range(f - 8, f + 7):
        rr = rep(fr, rig.parts_on_bones(arm_L), body + hs + cup)
        pairs = max(pairs, sum(rr.values()))
        pos, ax = rig.slot_world(fr)
        dg = bpy.context.evaluated_depsgraph_get()
        ae = rig.arm.evaluated_get(dg)
        D = ae.matrix_world @ ae.pose.bones['hand_L'].matrix @ rig._rest['hand_L'].inverted()
        d = D @ pin['point'] - pos
        off = max(off, (d - ax * d.dot(ax)).length)
        if fr == f:
            above = d.dot(ax)
    print(f'    S05/S07 post f-8..f+6         {pairs:4d} pairs max  pinch above slot at contact {above * 1000:4.1f} mm, '
          f'max off-axis {off * 1000:4.2f} mm  pad gap {pin["pad_gap"] * 1000:.1f} mm', flush=True)
    # S05 padlock post: gap 30 mm, the padlock mesh riding in the hand (f500-514, contact f508)
    f = 3508
    for fr in range(f - 9, f + 8):
        base(fr)
    pad = None
    padm = []
    # the lowest pinch (extent) at which the padlock clears the slot and nothing touches the lid
    for ext in (S.PADLOCK_EXTENT, S.PADLOCK_EXTENT + 0.006, S.PADLOCK_EXTENT + 0.012, S.PADLOCK_EXTENT + 0.02):
        rig.post(f, gap=PADLOCK_GAP, extent=ext, fingers=S.PADLOCK_FINGERS)
        pos, ax = rig.slot_world(f)
        pad = hold_padlock(rig, f, follow=True, pad=pad, slot=(pos, ax))
        low = padlock_reach(rig, pad, f, pos, ax)
        padm = [o for o in [pad] + list(pad.children_recursive) if o.type == 'MESH']
        clean = sum(rep(f, rig.parts_on_bones(arm_L) + padm, cup + body + hs).values()) == 0
        if low >= 0.0015 and clean and pad['hand_pairs'] == 0:
            break
    worst_p, wf = 0, None
    for fr in range(f - 8, f + 7):
        rr = rep(fr, rig.parts_on_bones(arm_L) + padm, cup + body + hs)
        rr.update(rep(fr, padm, rig.parts_on_bones(arm_L)))
        n = sum(rr.values())
        if n > worst_p:
            worst_p, wf = n, (fr - f, worst(rr))
    pin = rig.thumb_pinch('L', gap=PADLOCK_GAP)
    print(f'    S05 padlock post f-8..f+6     {worst_p:4d} pairs max {wf or ""}  padlock lowest point {low * 1000:+.1f} mm '
          f'above the slot at contact (extent {ext * 1000:.1f} mm, padlock x fingers {pad["hand_pairs"]})  '
          f'pad gap {pin["pad_gap"] * 1000:.1f} mm', flush=True)
    for o in [pad] + list(pad.children_recursive):
        bpy.data.objects.remove(o, do_unlink=True)
    # S13: the lift, every 3rd frame, cup + right arm vs body (headset is off in S13)
    f0 = 4249 - 9
    base(f0)
    for fr in range(f0 + 1, f0 + 70):
        rig.pose(fr, k, root_loc=tuple(sp), root_rot=0.0)
    contact = rig.sip(4249)
    rig.sip_stage(contact + 8, 3, k)
    worst_n, worst_f = 0, None
    for fr in range(4249, contact + 4, 3):
        rr = rep(fr, rig.parts_on_bones(arm_R) + cup, rig.parts_on_bones(['chest', 'neck', 'head', 'badge', 'spine']))
        n = sum(rr.values())
        if n > worst_n:
            worst_n, worst_f = n, (fr, worst(rr))
    sc = bpy.context.scene
    sc.frame_set(contact)
    dg = bpy.context.evaluated_depsgraph_get()
    cax = (rig.cup.evaluated_get(dg).matrix_world.to_3x3() @ Vector((0, 0, 1))).normalized()
    ae = rig.arm.evaluated_get(dg)
    E = ae.matrix_world @ ae.pose.bones['forearm_R'].head - Vector(sp)
    print(f'    S13 sip f1249-1300 (every 3rd) {worst_n:4d} pairs worst  {worst_f or ""}  cup tilt at contact '
          f'{math.degrees(cax.angle(Vector((0, 0, 1)))):.1f} deg  elbow y {E.y:+.3f} z {E.z:.3f}', flush=True)
    print(f'    report {time.time() - t0:.1f}s', flush=True)


# ------------------------------------------------------------------ main

def main():
    a = args()
    t0 = time.time()
    sc = C.new_scene(1, 4400, a.quality, samples=a.samples)
    w, h = (int(x) for x in a.res.split('x'))
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.use_motion_blur = False
    M.set_quality(a.quality)
    room = R.build(placeholder=False, state='lit', render_budget=False)
    room.render_budget(samples=a.samples)          # the room's light paths, our sample count
    if hasattr(R, 'demo_timeline'):
        R.demo_timeline(room)
    if not a.no_rim:
        rim_light(C.collection('Synergy_light_proposal'))
        bounce_light(C.collection('Synergy_light_proposal'))
    tl = face_timeline()
    rig = S.build(timeline=tl, location=R.SYNERGY_POS)
    print(f'BUILD {time.time() - t0:.1f}s  samples {sc.cycles.samples}', flush=True)
    sp = Vector(R.SYNERGY_POS)
    if a.report or a.report_only:
        overlap_check(rig, sp)        # before staging: the headset is still on his head
    cams = stage(rig, room)
    if a.save_blend:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(a.save_blend))
    names = [x for x in a.only.split(',') if x] or (list(DEFAULT) + (list(EXTRA) if a.all else []))
    os.makedirs(a.out, exist_ok=True)
    if not (a.no_render or a.report_only):
        for name in names:
            f, cam = cams[name]
            sc.camera = cam
            sc.frame_set(f)
            room.hide_from_camera('head') if name == 's11_dip' else room.hide_from_camera()
            path = os.path.join(a.out, f'room_{name}.png')
            sc.render.filepath = path
            t1 = time.time()
            bpy.ops.render.render(write_still=True)
            print(f'RENDERED {name} frame={f} {time.time() - t1:.1f}s -> {path}', flush=True)
            report_colours(name, path, rig, cam, f)
    print(f'TOTAL {time.time() - t0:.1f}s', flush=True)


if __name__ == '__main__':
    main()
