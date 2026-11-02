"""S03 'The drop' (film frames 257-352, beats 16-21): the one-point wide of the Long Room.

    blender -b --factory-startup -P shots/s03_the_drop.py -- --quality proof --only 257,300,321,352
    blender -b --factory-startup -P shots/s03_the_drop.py -- --quality animatic --step 8
    blender -b --factory-startup -P shots/s03_the_drop.py -- --quality final        # 32 spp unless --samples

The beat drops on the cut. The 30 m walnut table in perfect symmetry, nine CRT colleagues
on their chairs (swivelled toward the foot camera, R.SHOT_SEAT_YAW['s03']), their yellow
cords laid proud on the walnut (R.SHOT_CORDS['s03']) so nine lines converge on the hub, the
skylight slab down the spine, and Synergy small and upright at the vanishing point with the
cup at chest height. The printer is the soft lower foreground; the droid sets off up the
camera-right lane at f300.

Frame by frame (sync points on the treatment's frames):
  f257  cut on the drop (bar downbeat): a sheet leaves the printer's tray lip and drops past
        its silhouette (the feed started off screen at f245, so the visible drop, not the
        hidden tray run, is on the downbeat); it settles on the stack at f265.
        The camera is already pushing in at a constant speed.
  f300  the paper droid sets off from its lane beside the foot, towing the trolley (reams
        to table height, the cobalt binder on top), up camera-right.
  f309  the push begins to ease (cosine), coming to rest by f352: PUSH_Y's 0.70 m, with the
        printer, its chair, the stack, the droid and the trolley clear of the frame edges.
  f320  Synergy's one small attentive shoulder shift: the left shoulder lifts 2 deg and
        squares forward over 10 frames (f320-330), then holds. The cup never moves.
  f321  bar downbeat: the next sheet drops past the printer (feed from f309), settling on
        the growing stack at f329.
  f353  cut to S04.
Sound: the visible drops are on 257/321, the stack hits on 265/329.

Room events: room_timeline() below, env_room.demo_timeline's events that touch f257-352 (as
S04/S05 copy them), except the two feeds, which start 12 frames early (above). The stack
holds the same two sheets at the cut to S04 either way (same landing order and positions).
Camera: env_room.preview_camera(room, 's03_wide') (approved: 50 mm level camera on the axis
behind the hidden foot wall, shift for rigid verticals, f/4 focused at 18 m), with the push
re-keyed here as linear-then-eased (treatment: 'linear and eased at the end') and started
1.4 m further back (PUSH_Y), so the foreground's floor contacts never sit on the bottom edge.
Light (shot-local, on top of the room's): +1 EV view exposure and a light 0.15 mist, so the
room's volume reads; a soft graze down each long wall (panels only), so the acoustic bays
read charcoal and converge; the rig owner's warm walnut bounce and cool backlight (Synergy
only); a small kicker on the cup and a glint on Kevin's padlock.
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
DROP = 257                  # bar downbeat: the cut, the drop, a sheet drops past the printer
DROID_GO = 300              # the droid sets off (the room timeline)
SHIFT = (320, 330)          # the one attentive shoulder shift, 2 deg over 10 frames
FEED_2 = 321                # bar downbeat: the second sheet drops
# props.Printer.feed(f, dur=20): the tray run (f .. f+11) is hidden from this rear view, the
# sheet clears the lip at f+11 and lands at f+20. Start each feed 12 frames before its bar so
# the visible drop is on the downbeat.
FEED_LEAD = 12
FEEDS = (DROP - FEED_LEAD, FEED_2 - FEED_LEAD)       # 245, 309

# camera push: 0.70 m from 1.4 m behind the approved s03_wide start (y -39.0): constant speed
# from the cut, then a cosine ease to rest. Every foreground object stands on the floor at
# y -29.3 .. -31.6, and from the approved -39.0 those floor contacts sit on the bottom edge: the
# preview's 1.5 m push ran the printer, its chair and the stack out of frame, and no shorter
# push from -39.0 clears them (the printer chair's star base straddles the edge throughout and
# the stack's base lands on it at the end of a 0.4-0.7 m push). From -40.4 all of them stay
# inside. Measured bottom margins (fraction of frame height), f257 -> f352: the chair's star
# base 0.093 -> 0.032, the stack's base 0.171 -> 0.123, the printer's base 0.253 -> 0.207, the
# trolley's casters >= 0.143, the droid >= 0.206; the trolley's right side >= 0.137 inside
# the right edge. Synergy is 3.5% smaller than from -39.0, still dead centre.
PUSH_Y = (-40.40, -39.70)
PUSH_EASE_FROM = 0.55       # fraction of the shot at which the ease-out begins
PAPER_K = 0.35              # the printer's paper: this fraction of the foot fill (paper_fill)

# the look: view exposure (stops) and the compositor's depth mist for this wide
EXPOSURE = 1.0
MIST = 0.15
FINAL_SPP = 32              # final tier without --samples (the 'wide' budget's 12 boils on emissive edges)


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


# ---------------------------------------------------------------- the room's side

def room_timeline(room):
    """env_room.demo_timeline's events that touch f257-352 (the same calls S04 and S05 make,
    so the LED phase, the droid's run and its f712 hand-off agree), with this shot's feeds."""
    pr = room.printer
    for f in FEEDS:
        pr.feed(f)
    pr.led_pulse(1, 1048)
    d = room.droid
    d.blink(1, 1440, 48)
    lane = R.ROOM['droid_lane_x']
    x0, y0 = R.ROOM['droid_start']
    d.place(299, x0, y0, R.ROOM['droid_start_heading'])
    d.drive(300, 712, [(x0, y0), (x0, y0 + 1.2), (lane, -26.0), (lane, -8.0)] + R.droid_handoff_path(lane)[1:],
            ease='cruise', accel=0.04)


def check_room_sync(room):
    """Warn if the room timeline's beats have moved off the treatment's frames: each sheet
    must clear the tray lip on its bar's downbeat (first falling frame on DROP / FEED_2) and
    the droid must set off on DROID_GO."""
    sc = bpy.context.scene
    starts = []
    for s in room.printer.sheets:
        fc = next((c for c in C.fcurves(s.animation_data.action) if c.data_path == 'hide_render'), None)
        if fc is not None:
            starts += [int(round(k.co.x)) for k in fc.keyframe_points if k.co[1] < 0.5]
    for f in (DROP, FEED_2):
        if f - FEED_LEAD not in starts:
            print(f'S03 SYNC WARNING: no sheet drops on f{f} (feeds start {sorted(starts)[:4]})', flush=True)
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


def paper_fill(room, k=PAPER_K):
    """The printer's paper reads as one material. env_room's foot fill skips the white paper
    (the floor stack, the trolley's reams) so it sits under the subject, but the sheets that
    Printer.feed creates later are not in that exclusion: each landed sheet popped bright white
    on the dark stack (a library gap, worked around here). The fed sheets join the exclusion,
    and a copy of the foot fill at `k` of its power, linked to the stack and the sheets only,
    lights all the printer's paper alike: a pale sheet slides over the beige tray, drops and
    lands on a stack of the same tone.

    The copied light data carries the foot fill's energy action (set_state keys it), which
    would override the scaled energy at render time: it is cleared, and S03 is lit throughout,
    so a constant is right."""
    ff = room.foot_fill
    excl = ff.light_linking.receiver_collection
    for s in room.printer.sheets:
        if excl.objects.get(s.name) is None:
            excl.objects.link(s)
    for co in excl.collection_objects:
        co.light_linking.link_state = 'EXCLUDE'
    pl = ff.copy()
    pl.data = ff.data.copy()
    pl.data.animation_data_clear()
    if pl.animation_data is not None:
        pl.animation_data_clear()
    pl.name = pl.data.name = 's03_paper_fill'
    bpy.context.scene.frame_set(START)
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


# ---------------------------------------------------------------- shot-local light

def _receivers(name, objs):
    coll = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    for o in objs:
        if o.type in ('MESH', 'CURVE') and coll.objects.get(o.name) is None:
            coll.objects.link(o)
    return coll


def _tree(root):
    return [root] + list(root.children_recursive)


def _shot_light(name, loc, target, energy, size, size_y, color, receivers):
    """An area light invisible to camera rays, lighting `receivers` only (fills also turn off
    their glossy contribution; the glints keep it)."""
    lt = C.area_light(name, loc, target, energy, size, size_y, color=color, coll=C.collection('s03_lights'))
    lt.visible_camera = False
    lt.light_linking.receiver_collection = receivers
    return lt


WALL_GRAZE = dict(energy=60.0, y=(-28.0, -8.0), x_off=0.9, z=5.6, color=(0.85, 0.88, 1.0))


def wall_graze(room, g=WALL_GRAZE):
    """A long soft card high over each long wall, 0.9 m off it and aimed down across the
    panels (light-linked to that wall's acoustic panels only): the bays read as charcoal with
    their shadow gaps, and the two walls converge on the vanishing point. It stops 8 m short
    of the head, where the room's own head-end wash takes over, so the walls fall away toward
    the dark head wall."""
    x1 = R.ROOM['interior_x'][1]
    y0, y1 = g['y']
    out = []
    for side, key in ((-1, 'left'), (1, 'right')):
        panels = [o for o in room.walls[key] if o.name.startswith('panel_')]
        lt = _shot_light(f's03_wall_graze_{key}', (side * (x1 - g['x_off']), (y0 + y1) / 2, g['z']), None,
                         g['energy'], 0.5, y1 - y0, g['color'], _receivers(f's03_graze_{key}', panels))
        R.aim_light(lt, Vector((side * 1.0, 0.0, -0.55)))
        lt.visible_glossy = False
        out.append(lt)
    return out


def walnut_bounce(rig_coll):
    """The warm walnut bounce the rig owner asked for (tools/synergy_in_room.py's proposal):
    the slab's reflection off the table lifting his lower torso, arms and cup. Invisible to
    camera and glossy rays, and light-linked to Synergy alone, so it never warms the hub, the
    head wall or the walnut around him. Raised from the proposal so its lower edge clears the
    walnut (the same 31 deg tilt): no samples are spent inside the table or the hub."""
    sp = Vector(R.SYNERGY_POS)
    tilt = math.radians(31.0)
    loc = Vector((sp.x, sp.y - 0.80, R.TABLE_TOP + 0.02 + 0.25 * math.cos(tilt)))
    aim = loc + Vector((0.0, math.cos(tilt), math.sin(tilt)))
    lt = _shot_light('s03_walnut_bounce', tuple(loc), tuple(aim), 9.0, 1.1, 0.5, (1.0, 0.84, 0.70), rig_coll)
    lt.visible_glossy = False
    return lt


def back_rim(rig_coll, energy=70.0):
    """The rig owner's proposed backlight (tools/synergy_in_room.py rim_light): the slab's
    spill off the head wall, high behind him on his left. It lifts his crown, shoulders and
    the left pauldron's top edge (the f320 shift) off the dark head wall."""
    sp = Vector(R.SYNERGY_POS)
    return _shot_light('s03_back_rim', tuple(sp + Vector((0.35, 1.05, 2.55))), (sp.x, sp.y, 1.55), energy,
                       0.9, 0.35, (0.86, 0.91, 1.0), rig_coll)


def cup_kicker(rig, energy=20.0):
    """A small cool card from the camera side, linked to the cup alone: the white cup sits
    about half a stop over his ivory plates and reads as a white chip at chest height."""
    cup = rig.cup_objects()
    sc = bpy.context.scene
    sc.frame_set(START)
    c = cup[0].matrix_world.translation + Vector((0.0, 0.0, 0.06))
    lt = _shot_light('s03_cup_kicker', tuple(c + Vector((-0.45, -1.2, 0.55))), tuple(c), energy, 0.25, 0.25,
                     (0.95, 0.97, 1.0), _receivers('s03_cup_receivers', cup))
    lt.visible_glossy = False
    return lt


def padlock_glint(room, energy=40.0):
    """A small warm kicker on Kevin's padlock alone, from the foot side and a little above, so
    its broad brass face (turned toward the foot) mirrors it at the camera: one brass glint
    at his place in the wide (2-3 px at 1600) that pays off at the cut to S04."""
    pad = room.props['kevin'][0]
    p = pad.matrix_world.translation
    tgt = _receivers('s03_padlock', _tree(pad))
    return _shot_light('s03_padlock_glint', tuple(p + Vector((0.35, -2.2, 0.45))), tuple(p + Vector((0, 0, 0.03))),
                       energy, 0.15, 0.15, (1.0, 0.93, 0.80), tgt)


# ---------------------------------------------------------------- Synergy and camera

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
    rig.bake_pauldrons(START, END)


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

    # environment: the whole room (every part of it is in this frame), its timeline for this shot
    room = R.build(placeholder=False, state='lit', seat_yaw_deg=R.SHOT_SEAT_YAW[SHOT])
    room_timeline(room)
    check_room_sync(room)
    paper_fill(room)

    # Synergy: idle face (mouth row at 11%, no blink), performance keyed on film frames
    tl = F.FaceTimeline(START, END)
    rig = S.build(timeline=tl, location=R.SYNERGY_POS)
    stage_synergy(rig)
    M.set_quality(args.quality)                              # the rig's materials too
    syn = bpy.data.collections['Synergy']

    # camera: the approved framing (also lays the cords proud and hides the foot wall), with
    # this shot's push
    _, cam = R.preview_camera(room, 's03_wide')
    key_push(cam)
    sc.camera = cam

    # shot-local light
    wall_graze(room)
    walnut_bounce(syn)
    back_rim(syn)
    cup_kicker(rig)
    padlock_glint(room)

    # render settings and the house look. A fixed sampling seed: the push eases to almost
    # nothing from f330, so an animated seed boils screen edges, cords and his silhouette.
    spp = args.samples or (FINAL_SPP if args.quality == 'final' else None)
    room.render_budget(kind='wide', samples=spp, locked=True)
    room.compositor(threshold=0.9, mist_amount=MIST)
    sc.view_settings.exposure = EXPOSURE
    room.tune_scanlines(cam)
    sc.frame_set(START)
    return room, rig, cam


if __name__ == '__main__':
    a = C.shot_args()
    build(a)
    C.render(SHOT, a, START, END)
