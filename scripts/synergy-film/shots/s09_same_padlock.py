"""S09 · f833-928 · E2_LONG_ROOM (lit): the same padlock again. He looks down. The praise stalls.

    blender -b --factory-startup -P shots/s09_same_padlock.py -- --quality proof --only 833,852,868,897,928
    blender -b --factory-startup -P shots/s09_same_padlock.py -- --quality final

The beats (film frames, 90 BPM = 16 frames a beat; TREATMENT.md S09):
  f833-856  Kevin speaks again, S04's three murmur bursts exactly (S04 f353/361/369 + 480 = f833/
            841/849, 8 frames each, the cue sheet's s09-kevin-murmur-1/2/3): his screen plays S04's
            kevin_speaks grammar, and his sky-blue key from behind the lens swells once per burst
            (a smooth raised-cosine envelope, rest 1.0, peak 1.4, no one-frame steps) across the
            face plate and upper chest, with a sky sheen across the walnut; steady from f857.
  f833-852  the same hero padlock, still gliding from Kevin's place (in the scene from f833, 1.9 m
            down-table behind the lens, so nothing switches on mid-shot), enters frame on f841
            (large and soft, passing the lens), decelerates at a constant rate and meets his left
            index tip still moving at S04's 0.30 m/s on f852: it stops dead (the knock). Its line
            runs 22 mm to his right of the tip, so the brass meets the bronze tip with its
            camera-right shoulder and the tip stays visible beside it.
  f857-868  his head pitches DOWN 12 deg (neck 4 + head 8, both A-frame pistons closing together)
            and turns 8 deg to his left, toward the padlock, in one mechanical move eased in and
            out; the eyes drop two LEDs and shift two LEDs to his left (at the padlock) on f857.
  f857-872  rack focus from the padlock to his face screen (f/1.6 for this shot, so it reads).
  f869-884  absolute stillness.
  f885-897  the praise wave leaves LED 1 at canon speed and stops dead at LED 9 on f897;
  f897-912  frozen; f913-920 it fades back to the 11% idle.
  f917-924  one slow blink (middle row, off, middle row, full).
  f921-928  his head lifts back to level (the eyes return inside the blink).
The cup never moves (right hand, chest height); no head dip; he never walks; locked camera.

Camera: the director's approved s09_low framing (env_room.preview_camera): lens 6 cm above
the walnut, 0.9 m down-table of the stop, 24 mm, looking back up at him; panned ~5 deg
(same lens, same position) so the padlock-to-face vertical sits on the frame's centre line.
Opened from f/2.8 to f/1.6 for this shot so the rack focus registers.
Light: the room as built, plus Kevin's saturated sky-blue key from behind the lens (narrow,
aimed at his screen and upper chest so it falls off down the torso), a glossy-only sky card
light-linked to the walnut (the sky sheen across the coat, same envelope), the slab's warm
bounce off the walnut on his lower torso (about a stop under the head), the skylight's spill
off the head wall as a cool rim, the padlock kit's warm card re-aimed for this lens, and
Room.front_bokeh's colleague discs set on one band at his eye line (Kevin's own disc is
dropped: his screen is behind the camera). The hub's mic LEDs are hidden from this lens.
Compositor: the house look plus a soft glare on the LED (emission) pass alone.
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
SYLLABLES = ((833, 8), (841, 8), (849, 8))   # S04's (353/361/369) + 480: the same murmur bursts
SPEAK_PULSE = 0.25          # S04: the whole field pulses this much brighter and dimmer
SPEAK_BAND = 1.5            # S04: band strength
SLIDE = (START, 852)        # padlock keyed from the cut (behind the lens) to the knock on f852
ENTER = 841                 # first frame any of it is in frame
V_KNOCK = 0.0125            # m per frame (0.30 m/s) when it meets the fingertip: S04's knock exactly
SLIDE_OFFSET = 0.022        # the slide line runs this far to his right (-X, frame left) of the tip
LOOK = (857, 868)           # head pitches down 12 deg (keyed f856 -> f868: moves on f857-868)
RACK = (856, 872)           # focus padlock -> face screen (keyed f856 -> f872: moves from f857)
STALL = (885, 897)          # wave head leaves LED 1 / stops dead at LED 9
HOLD_END = 912              # frozen until here, fades f913-920
BLINK = (917, 924)          # middle row, off, middle row, full
LIFT = (920, 928)           # head back to level (keyed f920 -> f928: moves on f921-928, the servo cue)
LOOK_DOWN = 12.0            # degrees, split between neck and head
NECK_SHARE = 4.0
LOOK_TURN = 8.0             # degrees toward his left (the padlock), head only, in the same move
EYES = (2, 2)               # (dx, dy) LEDs the eyes shift during the look: toward his left, down (one LED
                            # each way read as a look into the lens from this low frontal camera)

# camera
FSTOP = 1.6                 # approved lens and position; aperture opened so the rack focus registers

# light and look (tuned on proof renders)
KEVIN_E = 12.0              # Kevin's sky-blue key (W, at the envelope's rest level 1.0)
KEVIN_SAT = 1.7             # saturation push on Kevin's #b8d7fb for the key (1 = his pale screen colour)
KEVIN_GREEN = 0.78          # and its green pulled down a touch: on the warm enamel the product stays sky blue,
                            # not the cyan-green a pure saturation push gives
KEVIN_PEAK = 0.40           # envelope peak over rest at each murmur burst (raised cosine; <= ~4% a frame)
KEVIN_SIZE = (0.30, 0.24)   # the key's area (m)
KEVIN_SPREAD = 20.0         # degrees: a narrow fan, aimed at his screen and upper chest
KEVIN_AIM_DZ = -0.06        # aim this far below the screen centre
SKY_E = 2.4                 # the glossy-only sky card over the walnut (W at rest)
SKY_POS = (0.10, 0.65, 0.12)   # its centre: off his position (x, y) and above the walnut (z)
SKY_SIZE = (2.6, 1.4)       # across the table, along it
BOUNCE_E = 3.5              # the slab's warm bounce off the walnut (lower torso)
BOUNCE_AIM_Z = 0.98         # bounce aimed at his pelvis plate, not the badge
RIM_E = (90.0, 60.0)        # the skylight's spill off the head wall, high behind him (his left, his right)
CARD_E, CARD_DIST, CARD_UP = 4.0, 0.55, 0.20     # the padlock's warm face card
BOKEH_SEED = 8
BOKEH_ORDER = (('operations', 0.10), ('keys', 0.20), ('synthia', 0.30),      # his right: frame left
               ('arjun', 0.70), ('strategy', 0.80), ('people', 0.90))         # his left: frame right
BOKEH_PX = (60.0, 64.0)     # disc widths at 1600 px (similar sizes)
BOKEH_BEHIND = (8.0, 8.6)   # metres beyond him (similar depths)
LED_GLOW = 0.45             # extra fog-glow strength on the emission pass (LEDs, bokeh), 0 = off
LED_GLOW_THRESHOLD = 1.2
PAN_GAIN = 1.0              # 1 = the padlock/face axis exactly on the centre line, 0 = as approved

HAND_L = ['hand_L'] + [f'{n}_{i}_L' for n in ('index', 'middle', 'ring', 'pinky') for i in (1, 2, 3)] + \
    [f'thumb_{i}_L' for i in range(3)]


def face_timeline():
    tl = F.FaceTimeline(START, END)
    # the praise starts and stalls halfway: head on LED 9 at f897, frozen to f912, fade f913-920
    tl.stall(STALL[0], stop_led=9, hold=HOLD_END - STALL[1], fade=8, stop_frame=STALL[1])
    # the eyes go to the padlock (down, toward his left) as the head starts down; they come back
    # inside the blink, before the lift
    tl.look(LOOK[0], LIFT[0], dx=EYES[0], dy=EYES[1])
    # one slow blink, f917-924: middle row (2), dark (3), middle row (2), full on f924
    b0 = BLINK[0]
    tl.eyes_rows(b0, b0 + 1, (1,), close=1)
    tl.eyes_rows(b0 + 2, b0 + 4, (), close=1)
    tl.eyes_rows(b0 + 5, b0 + 6, (1,), close=1)
    return tl


def kevin_speaks(t):
    """S04's kevin_speaks, shifted to S09's bursts: three pale bands sweep left to right across
    Kevin's field, one per murmur burst, while the whole field pulses about +-25%. His screen is
    behind the lens here, so this drives his own walnut pool (off screen); the key and the sky
    card on Synergy follow the smoothed envelope (kevin_env) instead of these keys."""
    lo, hi = 1.0 - SPEAK_PULSE, 1.0 + SPEAK_PULSE
    f0 = SYLLABLES[0][0]
    t.key(f0 - 1, 'LINEAR', band=-0.3, bamt=0.0, gain=1.0)
    for f, dur in SYLLABLES:
        t.key(f, 'LINEAR', band=-0.15, bamt=0.0, gain=lo)
        t.key(f + 1, 'LINEAR', bamt=SPEAK_BAND)
        t.key(f + dur // 2, 'LINEAR', gain=hi)
        t.key(f + dur - 2, 'LINEAR', bamt=0.9 * SPEAK_BAND)
        t.key(f + dur - 1, 'CONSTANT', band=1.15, bamt=0.0, gain=lo)
    fe = SYLLABLES[-1][0] + SYLLABLES[-1][1]
    t.key(fe, 'LINEAR', band=-0.3, bamt=0.0, gain=1.0)


def kevin_env(f):
    """Kevin's light on Synergy: rest 1.0, one raised-cosine swell per murmur burst (peak
    1 + KEVIN_PEAK mid-burst, back to rest exactly at the burst's end), so it reads as speech
    and never as a one-frame flicker."""
    v = 1.0
    for f0, dur in SYLLABLES:
        u = (f - f0) / float(dur)
        if 0.0 <= u <= 1.0:
            v += KEVIN_PEAK * 0.5 * (1.0 - math.cos(2.0 * math.pi * u))
    return v


def key_env(light, base):
    """Key light.data.energy = base * kevin_env(f) on every frame of the speech (LINEAR), held
    at base before and after."""
    f0 = SYLLABLES[0][0] - 1
    f1 = SYLLABLES[-1][0] + SYLLABLES[-1][1] + 1
    for f in [START - 1] + list(range(f0, f1 + 1)) + [END]:
        light.data.energy = base * kevin_env(f)
        light.data.keyframe_insert('energy', frame=f)
    for fc in C.fcurves(light.data.animation_data.action):
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'


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
    # Kevin again: S04's murmur, burst for burst (the identical sample is the joke)
    kevin_speaks(room.terminals['kevin'])


def stage_synergy(tl):
    rig = S.build(timeline=tl, location=R.SYNERGY_POS)
    k = 'BEZIER'
    # f833: standing, cup at chest height, left index tip resting on the walnut (env_room's
    # fingertip_L contract), the canon 4 deg head roll
    rig.apply_preset(START, 'reach_L', k)
    level = dict(neck=(0.0, 0.0, 0.0), head=S.CANON_HEAD)
    down = dict(neck=(NECK_SHARE, 0.0, 0.0), head=(LOOK_DOWN - NECK_SHARE, S.CANON_HEAD[1], LOOK_TURN))
    for f, pose in ((LOOK[0] - 1, level), (LOOK[1], down), (LIFT[0], down), (LIFT[1], level)):
        rig.pose(f, k, **pose)
    return rig


def padlock_slide(room, rig, cam):
    """The hero padlock slides in from behind the lens and stops dead against the real index tip
    (zero overlap, 1.5 mm short of contact) on the knock. Its line is parallel to the glide from
    Kevin's place but SLIDE_OFFSET to his right, so it meets the tip with its camera-right
    shoulder and the bronze tip shows beside the brass."""
    pad = room.props['kevin'][0]
    sc = bpy.context.scene
    sc.frame_set(SLIDE[1])
    home = Vector(R.prop_home('kevin'))
    contract = Vector(R.stop_for('padlock', obj=pad, start=tuple(home)))
    dirn = (contract - home).normalized()
    side = Vector((-dirn.y, dirn.x))                 # perpendicular in plan, toward -X (his right)
    if side.x > 0:
        side = -side
    off = side * SLIDE_OFFSET
    tip = Vector(R.ROOM['fingertip_L'][:2]) + off    # the tip's line moved over: the sweep stays parallel
    start = contract - dirn * 1.6 + off
    stop = Vector(R.stop_for('padlock', obj=pad, start=(start.x, start.y), tip=(tip.x, tip.y),
                             hand=rig.parts_on_bones(HAND_L)))
    # it has been gliding since it left Kevin (S04's glide): in the scene from the cut, behind
    # the lens, it enters frame exactly on ENTER, R_enter short of the stop (the largest R that
    # shows any of it on ENTER and none on ENTER - 1), and decelerates at a constant rate
    for k in range(0, 25):
        r_enter = 0.95 - 0.025 * k
        key_glide(pad, stop, dirn, r_enter)
        if in_frame(pad, cam, ENTER):
            break
    if in_frame(pad, cam, ENTER - 1):
        print('S09 WARNING: the padlock shows before ENTER', flush=True)
    # held at the stop to the cut (the frame_set probes above left other values in .location)
    pad.location = (stop.x, stop.y, pad.location.z)
    pad.keyframe_insert('location', frame=END)
    v0 = 2.0 * r_enter / (SLIDE[1] - ENTER) - V_KNOCK
    a = (v0 - V_KNOCK) / (SLIDE[1] - ENTER)
    t0 = SLIDE[1] - START
    print(f'S09 padlock glide: {r_enter:.3f} m short of the stop on f{ENTER}, entering at {v0 * C.FPS:.2f} m/s, '
          f'knock at {V_KNOCK * C.FPS:.2f} m/s; {V_KNOCK * t0 + 0.5 * a * t0 * t0:.2f} m short on f{START}', flush=True)
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
    """Kevin's screen is behind the lens: a saturated sky-blue key from the camera side, a narrow
    fan aimed at his face screen and upper chest (it falls off down the torso), swelling once per
    murmur burst on the smoothed envelope and steady after. Not seen by the camera, no sheen."""
    t = room.terminals['kevin']
    bpy.context.scene.frame_set(START)
    face = rig.screen_point(0.5, 0.45)
    src = t.to_world((0.0, P.CRT['front'], P.CRT['zs']))
    d = (src - face).normalized()
    pos = face + d * 2.4
    col = kevin_colour(t)
    lt = C.area_light('s09_kevin_key', tuple(pos), tuple(face + Vector((0.0, 0.0, KEVIN_AIM_DZ))), 1.0,
                      KEVIN_SIZE[0], KEVIN_SIZE[1], color=col, coll=C.collection('S09_light'))
    lt.visible_camera = False
    lt.visible_glossy = False           # no broad grey sheen across the enamel or the coat
    lt.data.spread = math.radians(KEVIN_SPREAD)
    key_env(lt, KEVIN_E)
    return lt


def kevin_colour(t):
    """Kevin's pale #b8d7fb pushed in saturation (1 - (1 - c) * KEVIN_SAT) and its green eased
    (KEVIN_GREEN), so it reads as sky blue on the warm enamel under AgX."""
    r, g, b = (max(0.0, 1.0 - (1.0 - c) * KEVIN_SAT) for c in t.light.data.color)
    return (r, g * KEVIN_GREEN, b)


def walnut_sky(room, rig):
    """Kevin's sky light on the walnut: a glossy-only card in his colour over the head of the
    table, facing down and light-linked to the walnut alone, placed where this low lens sees it
    mirrored in the coat (a sky sheen across the foreground walnut, his reflection dark in it).
    Same envelope as the key."""
    t = room.terminals['kevin']
    sp = Vector(R.SYNERGY_POS)
    c = Vector((sp.x + SKY_POS[0], sp.y + SKY_POS[1], R.TABLE_TOP + SKY_POS[2]))
    lt = C.area_light('s09_walnut_sky', tuple(c), tuple(c - Vector((0.0, 0.0, 1.0))), 1.0, SKY_SIZE[0], SKY_SIZE[1],
                      color=kevin_colour(t), coll=C.collection('S09_light'))
    lt.rotation_euler = (0.0, 0.0, 0.0)                 # facing straight down, its long side across the table
    lt.visible_camera = False
    lt.visible_diffuse = False
    lt.visible_transmission = False
    lt.visible_volume_scatter = False
    lt.visible_glossy = True
    R._link_light(lt, R.walnut_objects(room), 'S09_walnut_sky_receivers')
    key_env(lt, SKY_E)
    return lt


def walnut_bounce():
    """The slab's warm bounce off the walnut in front of him (rig owner's note: the room gives his
    lower torso no light): lower torso and pelvis plate, about a stop under the head; arms, the
    cup and the back of the left hand take a little."""
    sp = Vector(R.SYNERGY_POS)
    lt = C.area_light('s09_walnut_bounce', (sp.x, sp.y - 0.80, R.TABLE_TOP + 0.02), (sp.x, sp.y - 0.05, BOUNCE_AIM_Z),
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
    cam.data.dof.aperture_fstop = FSTOP
    foc = cam.data.dof.focus_object
    sc = bpy.context.scene
    sc.frame_set(LOOK[1])
    face = rig.screen_point(0.5, 0.40)
    p0 = Vector((stop.x, stop.y, R.TABLE_TOP + 0.03))
    for f, p in ((START, p0), (RACK[0], p0), (RACK[1], face), (END, face)):
        C.key(foc, 'location', f, tuple(p))


def bokeh_band(room, cam, rig):
    """Room.front_bokeh's colleague discs, laid out on the room's rigid grid: one band at his eye
    line, three each side at even steps, symmetric about the frame's centre line, similar sizes
    and depths, every disc well clear of the frame edges, his head and the cup. Kevin's own disc
    is dropped (his screen is behind the camera: he lights Synergy, he is not behind him)."""
    from bpy_extras.object_utils import world_to_camera_view
    sc = bpy.context.scene
    discs = room.front_bokeh(cam, frame=LOOK[1], n=8, seed=BOKEH_SEED, disc_px=BOKEH_PX, behind=BOKEH_BEHIND)
    sc.frame_set(START)
    y = world_to_camera_view(sc, cam, rig.screen_point(0.5, 0.62)).y      # his eye line
    cd = cam.data
    res_x = sc.render.resolution_x * sc.render.resolution_percentage / 100.0
    res_y = sc.render.resolution_y * sc.render.resolution_percentage / 100.0
    sw, lens = cd.sensor_width, cd.lens
    sh = sw * res_y / res_x
    mw = cam.matrix_world
    loc, rot = mw.translation, mw.to_3x3()
    place = dict(BOKEH_ORDER)
    for o in discs:
        nm = o.get('bokeh_terminal')
        if nm not in place:
            o.hide_render = True
            o.hide_viewport = True
            continue
        x = place[nm]
        D = (o.location - loc).length
        dirc = Vector(((x - 0.5 + cd.shift_x) * sw / lens, (y - 0.5) * sh / lens + cd.shift_y * sw / lens, -1.0))
        dw = (rot @ dirc).normalized()
        o.location = loc + dw * D
        o.rotation_euler = (-dw).to_track_quat('Z', 'Y').to_euler()
    return discs


def led_glow(strength=LED_GLOW, threshold=LED_GLOW_THRESHOLD):
    """The treatment's LED-only glare: a soft fog glow from the emission pass alone (the face's
    LEDs; the soft bokeh discs sit under the threshold), added to the image ahead of the house
    look. Image-space only: no green ever lands on the chassis."""
    if strength <= 0:
        return None
    sc = bpy.context.scene
    sc.view_layers[0].use_pass_emit = True
    nt = sc.node_tree
    rl = next(n for n in nt.nodes if n.type == 'R_LAYERS')
    users = [(l.to_node, l.to_socket) for l in nt.links if l.from_socket == rl.outputs['Image']]
    g = nt.nodes.new('CompositorNodeGlare')
    g.glare_type = 'FOG_GLOW'
    g.quality = 'MEDIUM'
    nt.links.new(rl.outputs['Emit'], g.inputs['Image'])
    if 'Strength' in g.inputs:
        g.inputs['Threshold'].default_value = threshold
        g.inputs['Strength'].default_value = strength
        g.inputs['Size'].default_value = 0.55
    glow = g.outputs['Glare'] if 'Glare' in g.outputs else None
    if glow is None:                       # older node: glare + input; subtract the input back out
        sub = nt.nodes.new('CompositorNodeMixRGB')
        sub.blend_type = 'SUBTRACT'
        sub.inputs['Fac'].default_value = 1.0
        nt.links.new(g.outputs['Image'], sub.inputs[1])
        nt.links.new(rl.outputs['Emit'], sub.inputs[2])
        glow = sub.outputs[0]
    add = nt.nodes.new('CompositorNodeMixRGB')
    add.blend_type = 'ADD'
    add.inputs['Fac'].default_value = 1.0
    nt.links.new(rl.outputs['Image'], add.inputs[1])
    nt.links.new(glow, add.inputs[2])
    for node, sock in users:
        nt.links.new(add.outputs[0], sock)
    return g


def glint(rig, cam):
    """The reflected skylight slot on the face glass, re-aimed through the head moves."""
    keys = sorted({START, *range(LOOK[0] - 1, LOOK[1] + 1), *range(LIFT[0], LIFT[1] + 1), END})
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
    env = ' '.join(f'{kevin_env(f):.3f}' for f in range(SYLLABLES[0][0], SYLLABLES[-1][0] + SYLLABLES[-1][1] + 2))
    print(f'S09 Kevin envelope f{SYLLABLES[0][0]}..: {env}', flush=True)


def build(args):
    sc = C.new_scene(START, END, args.quality, samples=args.samples, threads=args.threads)
    M.set_quality(args.quality)
    room = R.build(state='lit', seat_yaw_deg=R.SHOT_SEAT_YAW[SHOT])
    room_timeline(room)
    rig = stage_synergy(face_timeline())
    pad = room.props['kevin'][0]
    room.key_visible(pad, START, True)           # in the scene from the cut (behind the lens): no mid-shot switch
    _, cam = R.preview_camera(room, 's09_low')    # the approved framing (and the padlock kit)
    sc.camera = cam
    centre_axis(cam, rig)
    pad, stop = padlock_slide(room, rig, cam)
    padlock_card(room, pad, cam)
    rack_focus(cam, rig, stop)
    kevin_key(room, rig)
    walnut_sky(room, rig)
    walnut_bounce()
    crown_rim()
    glint(rig, cam)
    room.hub.leds.visible_camera = False          # its mic LEDs: the only stray green in this frame
    room.hub.leds.visible_glossy = False
    bokeh_band(room, cam, rig)
    room.render_budget(kind='macro', samples=args.samples or None, locked=True)
    room.compositor(threshold=1.6)
    led_glow()
    room.tune_scanlines(cam)
    sc.view_settings.exposure = 0.0
    report(rig, cam, pad, stop)
    return room, rig, cam


if __name__ == '__main__':
    a = C.shot_args()
    build(a)
    C.render(SHOT, a, START, END)
