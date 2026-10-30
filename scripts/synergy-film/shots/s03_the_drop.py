"""S03 'The drop' (film frames 257-352, beats 16-21): the one-point wide of the Long Room.

    blender -b --factory-startup -P shots/s03_the_drop.py -- --quality proof --only 257,300,321,352
    blender -b --factory-startup -P shots/s03_the_drop.py -- --quality animatic --step 8
    blender -b --factory-startup -P shots/s03_the_drop.py -- --quality final

The beat drops on the cut. The 30 m walnut table in perfect symmetry, nine CRT colleagues
on their chairs (swivelled toward the foot camera, R.SHOT_SEAT_YAW['s03']), their yellow
cords laid proud on the walnut (R.SHOT_CORDS['s03']) so nine lines converge on the hub, the
skylight slab down the spine, and Synergy small and upright at the vanishing point with the
cup at chest height. The printer is the soft lower foreground; the droid sets off up the
camera-right lane at f300.

Frame by frame (sync points on the treatment's frames):
  f257  cut on the drop (bar downbeat): the printer starts a sheet feed (lands f277);
        the camera is already pushing in at a constant 20 mm/frame.
  f300  the paper droid sets off from its lane beside the foot, towing the trolley (reams
        to table height, the cobalt binder on top), at a measured pace up camera-right.
  f309  the push begins to ease (cosine), coming to rest by f352: 1.5 m in all, the
        approved s03_wide travel.
  f320  Synergy's one small attentive shoulder shift: the left shoulder lifts 2 deg and
        squares forward over 10 frames (f320-330), then holds. The cup never moves.
  f321  bar downbeat: the printer feeds the next sheet (lands f341) onto the growing stack.
  f353  cut to S04.

Room events come from env_room.demo_timeline (the film's single room timeline, so every
room shot agrees: printer feeds on each bar, the droid's run, the colleagues' props at home).
Camera: env_room.preview_camera(room, 's03_wide') (approved: 50 mm level camera on the axis
behind the hidden foot wall, shift for rigid verticals, f/4 focused at 18 m), with the push
re-keyed here as linear-then-eased (treatment: 'linear and eased at the end').
"""

import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'lib'))

import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import common as C  # noqa: E402
import env_room as R  # noqa: E402
import face as F  # noqa: E402
import materials as M  # noqa: E402
import synergy as S  # noqa: E402

SHOT = 's03'
INFO = next(s for s in json.load(open(os.path.join(HERE, 'shots.json'))) if s['id'] == SHOT)
START, END = INFO['start'], INFO['end']

# beats (film frames) this shot lands on
DROP = 257                  # bar downbeat: the cut, the drop, a printer feed
DROID_GO = 300              # the droid sets off (env_room.demo_timeline)
SHIFT = (320, 330)          # the one attentive shoulder shift, 2 deg over 10 frames
FEED_2 = 321                # bar downbeat: the second printer feed

# camera push: the approved s03_wide travel (y -39.0 -> -37.5), constant speed from the cut,
# then a cosine ease to rest over the last part of the shot
PUSH_Y = (-39.0, -37.5)
PUSH_EASE_FROM = 0.55       # fraction of the shot at which the ease-out begins
PAPER_K = 0.35              # the printer's paper: this fraction of the foot fill (paper_fill)


def push_profile(t, t0=PUSH_EASE_FROM):
    """Travel fraction 0..1 at shot time t (0..1): constant speed until t0, then the speed
    falls to zero along a half cosine (rest at t=1). Before the cut (t < 0) the camera keeps
    its cruise speed, so motion blur on the first frame sees it already moving."""
    t = min(1.0, t)
    v = 2.0 / (1.0 + t0)                              # cruise speed so the total travel is 1
    if t <= t0:
        return v * t
    u = (t - t0) / (1.0 - t0)
    # integral of 0.5 * v * (1 + cos(pi u)) over the ease, in shot time
    return v * t0 + v * (1.0 - t0) * 0.5 * (u + math.sin(math.pi * u) / math.pi)


def stage_synergy(rig):
    """Idle at the head of the table: canon head roll, cup at chest height in the right hand,
    faint breathing, and the one shoulder shift."""
    sp = tuple(R.SYNERGY_POS)
    rig.rest(START, 'BEZIER')
    rig.apply_preset(START, 'idle_cup', 'BEZIER')
    rig.pose(START, 'BEZIER', root_loc=sp, root_rot=0.0)
    # the shoulder shift: his LEFT shoulder (the free arm; camera-right in this wide) lifts
    # 2 deg and squares forward a touch, eased, then holds. relaxed_arm keyed it at rest.
    rig.pose(SHIFT[0], 'BEZIER', shoulder_L=(0.0, 0.0, 0.0))
    rig.pose(SHIFT[1], 'BEZIER', shoulder_L=(0.6, 2.0, 0.0))
    rig.breathe(START, END)


def walnut_bounce(rig_coll):
    """The warm walnut bounce the rig owner asked for (tools/synergy_in_room.py's proposal):
    the slab's reflection off the table lifting his lower torso, arms and cup. Invisible to
    camera and glossy rays, and light-linked to Synergy alone, so it never warms the hub, the
    head wall or the walnut around him."""
    sp = Vector(R.SYNERGY_POS)
    lt = C.area_light('s03_walnut_bounce', (sp.x, sp.y - 0.80, R.TABLE_TOP + 0.02), (sp.x, sp.y - 0.05, 1.22),
                      9.0, 1.1, 0.5, color=(1.0, 0.84, 0.70))
    lt.visible_camera = False
    lt.visible_glossy = False
    lt.light_linking.receiver_collection = rig_coll
    return lt


def paper_fill(room, k=PAPER_K):
    """The printer's paper reads as one material. env_room's foot fill skips the white paper
    (the floor stack, the trolley's reams) so it sits under the subject, but the sheets that
    Printer.feed creates later are not in that exclusion: each landed sheet popped bright white
    on the dark stack (a library gap, worked around here). The fed sheets join the exclusion,
    and a copy of the foot fill at `k` of its power, linked to the stack and the sheets only,
    lights all the printer's paper alike: a pale sheet slides over the beige tray, drops and
    lands on a stack of the same tone."""
    ff = room.foot_fill
    excl = ff.light_linking.receiver_collection
    for s in room.printer.sheets:
        if excl.objects.get(s.name) is None:
            excl.objects.link(s)
    for co in excl.collection_objects:
        co.light_linking.link_state = 'EXCLUDE'
    pl = ff.copy()
    pl.data = ff.data.copy()
    pl.name = pl.data.name = 's03_paper_fill'
    pl.data.energy = ff.data.energy * k
    for c in ff.users_collection:
        c.objects.link(pl)
    recv = bpy.data.collections.new('s03_paper_receivers')
    stack = [room.printer.stack] + list(room.printer.stack.children_recursive)
    for o in stack + list(room.printer.sheets):
        if o.type == 'MESH' and recv.objects.get(o.name) is None:
            recv.objects.link(o)
    pl.light_linking.receiver_collection = recv
    return pl


def check_room_sync(room):
    """The room's timeline (env_room.demo_timeline) carries this shot's beats: warn if a
    later edit there moves them off the treatment's frames."""
    sc = bpy.context.scene
    starts = []
    for s in room.printer.sheets:
        fc = next((c for c in C.fcurves(s.animation_data.action) if c.data_path == 'hide_render'), None)
        if fc is not None:
            starts += [int(round(k.co.x)) for k in fc.keyframe_points if k.co[1] < 0.5]
    for f in (DROP, FEED_2):
        if f not in starts:
            print(f'S03 SYNC WARNING: no printer feed starts on f{f} (feeds start {sorted(starts)[:4]})', flush=True)
    d = room.droid.root
    sc.frame_set(DROID_GO)
    p0 = d.matrix_world.translation.copy()
    sc.frame_set(DROID_GO - 1)
    pm = d.matrix_world.translation.copy()
    sc.frame_set(DROID_GO + 8)
    p1 = d.matrix_world.translation.copy()
    if (p0 - pm).length > 1e-4 or (p1 - p0).length < 0.02:
        print(f'S03 SYNC WARNING: the droid does not set off on f{DROID_GO}', flush=True)
    sc.frame_set(START)


def key_push(cam):
    """Re-key the approved camera's travel every frame (LINEAR keys on a baked profile)."""
    ad = cam.animation_data
    if ad is not None and ad.action is not None:
        bpy.data.actions.remove(ad.action)
    x, _, z = cam.location
    for f in range(START - 1, END + 2):                      # one frame either side for motion blur
        t = (f - START) / float(END - START)
        y = PUSH_Y[0] + (PUSH_Y[1] - PUSH_Y[0]) * push_profile(t)
        cam.location = (x, y, z)
        cam.keyframe_insert('location', frame=f)
    for fc in C.fcurves(cam.animation_data.action):
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'


def build(args):
    C.new_scene(START, END, args.quality, samples=args.samples, threads=args.threads)
    M.set_quality(args.quality)
    sc = bpy.context.scene

    # environment: the whole room (every part of it is in this frame), the film's room timeline
    room = R.build(placeholder=False, state='lit', seat_yaw_deg=R.SHOT_SEAT_YAW[SHOT])
    R.demo_timeline(room)
    check_room_sync(room)
    paper_fill(room)

    # Synergy: idle face (mouth row at 11%, no blink), performance keyed on film frames
    tl = F.FaceTimeline(START, END)
    rig = S.build(timeline=tl, location=R.SYNERGY_POS)
    stage_synergy(rig)
    M.set_quality(args.quality)                              # the rig's materials too
    walnut_bounce(bpy.data.collections['Synergy'])

    # camera: the approved framing (also lays the cords proud and hides the foot wall), with
    # this shot's push
    _, cam = R.preview_camera(room, 's03_wide')
    key_push(cam)
    sc.camera = cam

    # render settings and the house look
    room.render_budget(kind='wide', samples=args.samples or None)
    room.compositor(threshold=0.9)
    sc.view_settings.exposure = 0.0
    room.tune_scanlines(cam)
    return room, rig, cam


if __name__ == '__main__':
    a = C.shot_args()
    build(a)
    C.render(SHOT, a, START, END)
