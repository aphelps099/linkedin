"""S09 · f833-928 · E2_LONG_ROOM (lit): the same padlock again. He looks down. The praise stalls.

    blender -b --factory-startup -P shots/s09_same_padlock.py -- --quality proof --only 833,852,868,897,928
    blender -b --factory-startup -P shots/s09_same_padlock.py -- --quality final

The beats (film frames, 90 BPM = 16 frames a beat; TREATMENT.md S09):
  f833-868  Kevin speaks again (identical rhythm to S04: seed 7): his sky-blue key, behind the
            camera, pulses across Synergy's face plate, chest and the walnut, then holds steady.
  f836-852  the same hero padlock, still gliding from Kevin's place, is revealed behind the lens;
            it enters frame on f841 (large and soft, passing the lens), decelerates at a constant
            rate and meets his left index tip still moving on f852: it stops dead (the knock).
  f857-868  his head pitches DOWN 12 deg (neck 4 + head 8, both A-frame pistons closing
            together), one mechanical move eased in and out.
  f857-872  rack focus from the padlock to his face screen.
  f869-884  absolute stillness.
  f885-897  the praise wave leaves LED 1 at canon speed and stops dead at LED 9 on f897;
  f897-912  frozen; f913-920 it fades back to the 11% idle.
  f917-924  one slow blink (middle row, off, middle row, full).
  f921-928  his head lifts back to level.
The cup never moves (right hand, chest height); no head dip; he never walks; locked camera.

Camera: the director's approved s09_low framing (env_room.preview_camera): lens 6 cm above
the walnut, 0.9 m down-table of the stop, 24 mm f/2.8, looking back up at him; panned ~5 deg
(same lens, same position) so the padlock-to-face vertical sits on the frame's centre line.
Light: the room as built, plus Kevin's sky-blue key from behind the lens (driven by his screen,
so it pulses ~30% with the murmur and holds after f869), the slab's warm bounce off the walnut
(his lower torso), the skylight's spill off the head wall as a cool rim, the padlock kit's warm
card re-aimed for this lens, and Room.front_bokeh's colleague discs in the void behind him.
"""

import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'lib'))

import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import common as C  # noqa: E402
import env_room as R  # noqa: E402
import face as F  # noqa: E402
import materials as M  # noqa: E402
import props as P  # noqa: E402
import synergy as S  # noqa: E402

SHOT = 's09'
INFO = next(s for s in json.load(open(os.path.join(HERE, 'shots.json'))) if s['id'] == SHOT)
START, END = INFO['start'], INFO['end']

# ---------------------------------------------------------------- the beats (film frames)
SPEAK = (833, 869)          # Kevin's murmur: the same seed as S04, so the same rhythm
SLIDE = (836, 852)          # padlock: revealed behind the lens a beat before the knock (f852)
ENTER = 841                 # first frame any of it is in frame
V_KNOCK = 0.012             # m per frame (0.3 m/s): still moving when it meets the fingertip
LOOK = (857, 868)           # head pitches down 12 deg
RACK = (857, 872)           # focus padlock -> face screen
STALL = (885, 897)          # wave head leaves LED 1 / stops dead at LED 9
HOLD_END = 912              # frozen until here, fades f913-920
BLINK = (917, 924)          # middle row, off, middle row, full
LIFT = (921, 928)           # head back to level
LOOK_DOWN = 12.0            # degrees, split between neck and head
NECK_SHARE = 4.0

# light and look (tuned on proof renders)
KEVIN_E = 34.0              # Kevin's sky-blue key (W, at speaking rest level)
KEVIN_SAT = 1.0             # saturation push on Kevin's hue for the key
BOUNCE_E = 3.0              # the slab's warm bounce off the walnut
RIM_E = (90.0, 60.0)        # the skylight's spill off the head wall, high behind him (his left, his right)
CARD_E, CARD_DIST, CARD_UP = 4.0, 0.55, 0.20     # the padlock's warm face card
BOKEH = dict(seed=8, region=(0.06, 0.88, 0.70, 0.93))   # Room.front_bokeh layout: clear of his head and the edges
EYES_DOWN = 1               # LEDs the eyes glance down during the look (0 = none)
PAN_GAIN = 1.0              # 1 = the padlock/face axis exactly on the centre line, 0 = as approved

HAND_L = ['hand_L'] + [f'{n}_{i}_L' for n in ('index', 'middle', 'ring', 'pinky') for i in (1, 2, 3)] + \
    [f'thumb_{i}_L' for i in range(3)]


def face_timeline():
    tl = F.FaceTimeline(START, END)
    # the praise starts and stalls halfway: head on LED 9 at f897, frozen to f912, fade f913-920
    tl.stall(STALL[0], stop_led=9, hold=HOLD_END - STALL[1], fade=8, stop_frame=STALL[1])
    # the eyes drop one LED as the head starts down (he looks AT it), back up as it lifts
    if EYES_DOWN:
        tl.look(LOOK[0], LIFT[0] - 1, dx=0, dy=EYES_DOWN)
    # one slow blink, f917-924: middle row (2), dark (3), middle row (2), full on f924
    b0 = BLINK[0]
    tl.eyes_rows(b0, b0 + 1, (1,), close=1)
    tl.eyes_rows(b0 + 2, b0 + 4, (), close=1)
    tl.eyes_rows(b0 + 5, b0 + 6, (1,), close=1)
    return tl


def room_timeline(room):
    """The room's side of the film up to the end of this shot (env_room.demo_timeline's events
    that touch f833-928), so every continuity state is the one S03-S08 leave behind."""
    pr = room.printer
    for f in (257, 321, 385, 449, 513, 577, 641, 705, 769, 833, 897):
        pr.feed(f)
    pr.led_pulse(1, 1048)
    d = room.droid
    d.blink(1, 1440, 48)
    lane = R.ROOM['droid_lane_x']
    x0, y0 = R.ROOM['droid_start']
    d.place(299, x0, y0, R.ROOM['droid_start_heading'])
    d.drive(300, 712, [(x0, y0), (x0, y0 + 1.2), (lane, -26.0), (lane, -8.0)] + R.droid_handoff_path(lane)[1:],
            ease='cruise', accel=0.04)
    d.drive(737, 985, R.droid_exit_path(lane), reverse=True, ease='cruise', accel=0.06)
    room.key_visible(d.binder, 729, False)
    # S07's objects were all posted: none is left on the walnut (Pat's envelope never moved)
    for nm, i, f, dbl in R.S07_ARRIVALS:
        room.key_visible(room.props[nm][i], f + (8 if dbl else 16), False)
    # Kevin again: the same murmur (same seed, same syllables as S04's f353)
    room.terminals['kevin'].speak(SPEAK[0], SPEAK[1], seed=7)


def stage_synergy(tl):
    rig = S.build(timeline=tl, location=R.SYNERGY_POS)
    k = 'BEZIER'
    # f833: standing, cup at chest height, left index tip resting on the walnut (env_room's
    # fingertip_L contract), the canon 4 deg head roll
    rig.apply_preset(START, 'reach_L', k)
    level = dict(neck=(0.0, 0.0, 0.0), head=S.CANON_HEAD)
    down = dict(neck=(NECK_SHARE, 0.0, 0.0), head=(LOOK_DOWN - NECK_SHARE, S.CANON_HEAD[1], 0.0))
    for f, pose in ((LOOK[0] - 1, level), (LOOK[1], down), (LIFT[0], down), (LIFT[1], level)):
        rig.pose(f, k, **pose)
    return rig


def padlock_slide(room, rig, cam):
    """The hero padlock slides in from behind the lens and stops dead against the real index tip
    (zero overlap, 1.5 mm short of contact) on the knock."""
    pad = room.props['kevin'][0]
    sc = bpy.context.scene
    sc.frame_set(SLIDE[1])
    home = Vector(R.prop_home('kevin'))
    contract = Vector(R.stop_for('padlock', obj=pad, start=tuple(home)))
    dirn = (contract - home).normalized()
    stop = Vector(R.stop_for('padlock', obj=pad, start=tuple(contract - dirn * 1.6),
                             hand=rig.parts_on_bones(HAND_L)))
    # it has been gliding since it left Kevin (S04's glide): revealed a beat before the knock
    # behind the lens, it enters frame exactly on ENTER, R_enter short of the stop (the largest
    # R that shows any of it on ENTER and none on ENTER - 1), and decelerates at a constant rate
    for k in range(0, 25):
        r_enter = 0.95 - 0.025 * k
        key_glide(pad, stop, dirn, r_enter)
        if in_frame(pad, cam, ENTER):
            break
    if in_frame(pad, cam, ENTER - 1):
        print('S09 WARNING: the padlock shows before ENTER', flush=True)
    # held at the stop to the cut (the frame_set probes above left the f840 values in .location)
    pad.location = (stop.x, stop.y, pad.location.z)
    pad.keyframe_insert('location', frame=END)
    v0 = 2.0 * r_enter / (SLIDE[1] - ENTER) - V_KNOCK
    print(f'S09 padlock glide: {r_enter:.3f} m short of the stop on f{ENTER}, entering at {v0 * C.FPS:.2f} m/s, '
          f'knock at {V_KNOCK * C.FPS:.2f} m/s', flush=True)
    return pad, stop


def key_glide(pad, stop, dirn, r_enter):
    """Sliding friction: a constant deceleration through the reveal, so the padlock meets the
    fingertip still moving at V_KNOCK and stops dead there (the knock), r_enter metres short of
    the stop on ENTER. Keys every frame (linear) so motion blur sees the true speed."""
    n = SLIDE[1] - ENTER
    v0 = 2.0 * r_enter / n - V_KNOCK            # speed on ENTER (m per frame)
    a = (v0 - V_KNOCK) / n                      # deceleration (m per frame per frame)
    z = pad.location.z
    for f in range(SLIDE[0], SLIDE[1] + 1):
        t = SLIDE[1] - f                        # frames to the knock
        p = stop - dirn * (V_KNOCK * t + 0.5 * a * t * t)
        pad.location = (p.x, p.y, z)
        pad.keyframe_insert('location', frame=f)
    for fc in C.fcurves(pad.animation_data.action):
        if fc.data_path == 'location':
            for kp in fc.keyframe_points:
                if SLIDE[0] <= kp.co.x <= SLIDE[1]:
                    kp.interpolation = 'LINEAR'
    return v0, a


def kevin_key(room, rig):
    """Kevin's screen is behind the lens: a sky-blue key from the camera side across his face
    plate and chest (and the walnut, the padlock), driven by Kevin's screen state so it pulses
    in the speech rhythm and holds steady after. Not seen by the camera."""
    t = room.terminals['kevin']
    scr = t.screen
    bpy.context.scene.frame_set(START)
    face = rig.screen_point(0.5, 0.45)
    src = t.to_world((0.0, P.CRT['front'], P.CRT['zs']))
    d = (src - face).normalized()
    pos = face + d * 2.4
    # Kevin's pale #b8d7fb is pushed in saturation so it still reads as sky blue on the warm enamel
    col = tuple(1.0 - (1.0 - c) * KEVIN_SAT for c in t.light.data.color)
    lt = C.area_light('s09_kevin_key', tuple(pos), tuple(face + Vector((0.0, 0.0, -0.18))), 1.0, 0.55, 0.40,
                      color=col, coll=C.collection('S09_light'))
    lt.visible_camera = False
    lt.visible_glossy = False           # no broad grey sheen across the walnut coat
    lt.data.spread = math.radians(70)
    E = KEVIN_E
    v = [('on', scr, '["crt_on"]'), ('gain', scr, '["crt_gain"]'), ('sx', scr, '["crt_sx"]'),
         ('sy', scr, '["crt_sy"]'), ('bamt', scr, '["crt_bamt"]'), ('flare', scr, '["crt_flare"]')]
    P.add_driver(lt.data, 'energy', f'{E:.3f}*on*gain*flare*(0.12+0.88*sx*sy)*(1+0.3*bamt)', v)
    return lt


def walnut_bounce():
    """The slab's warm bounce off the walnut in front of him (rig owner's note: the room gives his
    lower torso no light): lower torso, arms, the cup and the back of the left hand."""
    sp = Vector(R.SYNERGY_POS)
    lt = C.area_light('s09_walnut_bounce', (sp.x, sp.y - 0.80, R.TABLE_TOP + 0.02), (sp.x, sp.y - 0.05, 1.22),
                      BOUNCE_E, 1.1, 0.5, color=(1.0, 0.84, 0.70), coll=C.collection('S09_light'))
    lt.visible_camera = False
    lt.visible_glossy = False
    return lt


def crown_rim():
    """The skylight's spill off the head wall, high behind him on both sides: his crown, headband,
    shoulder caps and the cup arm separate from the dark above him."""
    sp = Vector(R.SYNERGY_POS)
    out = []
    for sx, e in zip((1.0, -1.0), RIM_E):
        lt = C.area_light(f's09_rim_{"L" if sx > 0 else "R"}', (sp.x + 0.35 * sx, sp.y + 1.05, 2.55), (sp.x, sp.y, 1.55),
                          e, 0.9, 0.35, color=(0.86, 0.91, 1.0), coll=C.collection('S09_light'))
        lt.visible_camera = False
        out.append(lt)
    return out


def padlock_card(room, pad, cam):
    """The padlock kit's warm card (env_room 'padlock' kit, light-linked to the padlock, riding with
    it), moved to where the broad face we see mirrors it: the brass reads as a warm face instead
    of reflecting the black room."""
    card = room.insert_lights('padlock', target=pad)['card']
    sc = bpy.context.scene
    sc.frame_set(SLIDE[1])
    p = pad.matrix_world.translation.copy()
    c = cam.matrix_world.translation - p
    c = Vector((c.x, c.y, 0.0)).normalized()
    n = pad.matrix_world.to_3x3() @ Vector((0.0, -1.0, 0.0))
    n = Vector((n.x, n.y, 0.0)).normalized()
    if n.dot(c) < 0:
        n = -n
    mirror = (n * (2.0 * n.dot(c)) - c).normalized()
    pos = p + mirror * CARD_DIST + Vector((0.0, 0.0, CARD_UP))
    aim = (p + Vector((0.0, 0.0, 0.03))) - pos
    card.matrix_world = Matrix.Translation(pos) @ aim.to_track_quat('-Z', 'Y').to_matrix().to_4x4()
    card.data.energy = CARD_E
    return card


def in_frame(pad, cam, f):
    """Does any vertex of the padlock fall inside the frame at film frame f?"""
    from bpy_extras.object_utils import world_to_camera_view
    sc = bpy.context.scene
    sc.frame_set(f)
    dg = bpy.context.evaluated_depsgraph_get()
    for o in [pad] + list(pad.children_recursive):
        if o.type != 'MESH':
            continue
        ev = o.evaluated_get(dg)
        mw = ev.matrix_world
        for v in ev.data.vertices:
            q = world_to_camera_view(sc, cam, mw @ v.co)
            if 0.0 <= q.x <= 1.0 and 0.0 <= q.y <= 1.0 and q.z > 0:
                return True
    return False


def first_in_frame(pad, cam):
    return next((f for f in range(SLIDE[0], SLIDE[1] + 1) if in_frame(pad, cam, f)), SLIDE[1] + 1)


def centre_axis(cam, rig):
    """Pan the approved framing (same lens, same position) so the vertical between the padlock's
    stop and his face screen sits on the frame's centre line: the problem below, the face above."""
    from bpy_extras.object_utils import world_to_camera_view
    sc = bpy.context.scene
    stop = Vector((*R.ROOM['stop_L'], R.TABLE_TOP + 0.03))
    for _ in range(4):
        sc.frame_set(LOOK[1])
        bpy.context.view_layer.update()
        x = 0.5 * (world_to_camera_view(sc, cam, stop).x + world_to_camera_view(sc, cam, rig.screen_point(0.5, 0.5)).x)
        hfov = 2.0 * math.atan(cam.data.sensor_width / (2.0 * cam.data.lens))
        mw = cam.matrix_world.copy()
        R_ = Matrix.Rotation(-(x - 0.5) * hfov * PAN_GAIN, 4, 'Z')
        cam.matrix_world = Matrix.Translation(mw.translation) @ R_ @ Matrix.Translation(-mw.translation) @ mw


def rack_focus(cam, rig, stop):
    """Locked off; the rack focus from the padlock to his face screen, eased in and out."""
    foc = cam.data.dof.focus_object
    sc = bpy.context.scene
    sc.frame_set(LOOK[1])
    face = rig.screen_point(0.5, 0.40)
    p0 = Vector((stop.x, stop.y, R.TABLE_TOP + 0.03))
    for f, p in ((START, p0), (RACK[0], p0), (RACK[1], face), (END, face)):
        C.key(foc, 'location', f, tuple(p))


def glint(rig, cam):
    """The reflected skylight slot on the face glass, re-aimed through the head moves."""
    keys = sorted({START, LOOK[0] - 1, *range(LOOK[0], LOOK[1] + 1), LIFT[0], *range(LIFT[0], LIFT[1] + 1), END})
    for f in keys:
        rig.glass_glint(cam, f)


def report(rig, cam, pad, stop):
    """Measured sync points: when the padlock first shows in frame, its stop, the face in frame."""
    from bpy_extras.object_utils import world_to_camera_view
    sc = bpy.context.scene
    print(f'S09 padlock first in frame f{first_in_frame(pad, cam)} (want f{ENTER}); '
          f'stop {tuple(round(x, 4) for x in stop)}', flush=True)
    for f in (START, LOOK[1], HOLD_END, END):
        sc.frame_set(f)
        q = world_to_camera_view(sc, cam, rig.screen_point(0.5, 0.5))
        print(f'S09 f{f} face screen centre at image ({q.x:.3f}, {q.y:.3f})', flush=True)


def build(args):
    sc = C.new_scene(START, END, args.quality, samples=args.samples, threads=args.threads)
    M.set_quality(args.quality)
    room = R.build(state='lit', seat_yaw_deg=R.SHOT_SEAT_YAW[SHOT])
    room_timeline(room)
    rig = stage_synergy(face_timeline())
    pad = room.props['kevin'][0]
    room.key_visible(pad, START, False)          # posted in S05: gone until it comes back
    room.key_visible(pad, SLIDE[0], True)
    _, cam = R.preview_camera(room, 's09_low')    # the approved framing (and the padlock kit)
    sc.camera = cam
    centre_axis(cam, rig)
    pad, stop = padlock_slide(room, rig, cam)
    padlock_card(room, pad, cam)
    rack_focus(cam, rig, stop)
    kevin_key(room, rig)
    walnut_bounce()
    crown_rim()
    glint(rig, cam)
    room.front_bokeh(cam, frame=LOOK[1], **BOKEH)
    room.render_budget(kind='macro', samples=args.samples or None, locked=True)
    room.compositor(threshold=1.6)
    room.tune_scanlines(cam)
    sc.view_settings.exposure = 0.0
    report(rig, cam, pad, stop)
    return room, rig, cam


if __name__ == '__main__':
    a = C.shot_args()
    build(a)
    C.render(SHOT, a, START, END)
