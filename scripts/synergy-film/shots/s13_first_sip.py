"""S13 · f1249-1344 · E2_LONG_ROOM (dark): the first sip.

    blender -b --factory-startup -P shots/s13_first_sip.py -- --quality proof --only 1249,1265,1281,1297,1302,1305,1328,1336,1344
    blender -b --factory-startup -P shots/s13_first_sip.py -- --quality animatic --step 8
    blender -b --factory-startup -P shots/s13_first_sip.py -- --quality final

The beats (film frames, 90 BPM = 16 frames a beat; TREATMENT.md S13):
  f1249       S11's last pose: the head yawed 6 deg toward Pat (S11 holds it to its cut)
  f1249-1259  stage 1: the cup rises, level, from the chest to the sternum, and on the same step his face
              turns back from Pat to the cup (yaw -6 -> 0; hold to f1265)
  f1265-1275  stage 2: to the collar (hold to f1281)
  f1281-1291  stage 3: to chin level (hold)
  f1293-1297  the final rise: on f1297 the lid's spout meets the chin plate just under the
              screen, the cup tipped toward the face, the head eased back 5 deg. The cup runs on
              rig.sip's own clear, level path and timing, keyed every frame; the elbow travels
              smoothly between the four stage poses (smooth_sip: works round rig.sip's elbow flicks)
  f1297-1327  the mouth row fills like a progress bar: LED n (0-based) on at f1297 + round(n x 1.45),
              held at 70%; one fixed-height row, light travels left to right only
  f1299-1302  the eyes close down to their bottom row (top row out f1299, middle out f1301) and hold
  f1305-1344  the room begins to tilt: gravity turns toward his left (+X, frame right) in the room's
              frame, 4 deg by the cut (still accelerating into S14); the skylight slab slides 20 cm
              across the walnut and its edge travels over him; the badge swings on its clip after the
              new gravity; dust motes hanging in the slab in front of him drift toward frame right on the
              tilt's curve (the gravity cue in frame from the creak on); off screen the headset slides
              3.5 cm on the walnut from S11's set-down (S11.HEADSET_REST) over f1318-1334
  f1333-1336  the eyes reopen (middle row back f1333, top row f1335) to the full 2x3
He stays upright and deadpan; the cup stays at his chin through the cut. No head dip, no walking.

Camera: env_room's approved 's13_dark' framing: 65 mm f/2.8 at 1.35 m, 1.9 m from him, 8 deg toward
his right, aimed at his head; fixed to the room (it does not compensate for the tilt), locked off
with a 2% linear push; the crown's apex 7.5% of the frame height under the top edge. Focus on the
face glass (the LEDs carry the shot).
Light (chiaroscuro): the room's dark state (fills down, the slab stays) is the hard top key; the 'sip'
insert kit (a small neutral card and a thin rim for the white lid); the slab's warm bounce off the
walnut in front of him (rig owner's note: the room gives his lower torso no light); a faint cool
backlight (the slab's spill off the head wall) so the faceted crown and shoulders separate from the
void. A flag over his chest (light linking): the slab and the bounce reach the breastplate and his
left shoulder at a quarter strength, two stops under the head, so the head, the raised arm, the hand
and the white cup carry the frame. The skylight's reflected line on the face glass (rig.glass_glint)
is strong enough to read at the shot's exposure.
Room.front_bokeh puts the colleagues' discs behind him: in the dark only Pat's grey one is alive,
enlarged to a soft ~55 px glow (at 1600).

Not in frame (geometry, reported to the director): the treatment's headset 'in the soft lower-right
foreground', the badge and the far printer sheet. From 1.35 m a 65 mm frame's lower edge runs 6.8 deg
below the lens axis, so the walnut (0.6 m under the lens, the headset ~1.3 m away, ~24 deg down) is
never in it, the badge hangs under the frame's bottom edge, and the printer is 31 m behind the lens.
The headset's slide and the badge's swing are still keyed (continuity for S14); the gravity cues on
screen are the dust motes' drift (from ~f1310) and the slab's edge sliding off his right shoulder, arm
and head wedge (from ~f1325).
"""

import json
import math
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'lib'))
sys.path.insert(0, HERE)

import bpy  # noqa: E402
from mathutils import Quaternion, Vector  # noqa: E402

import common as C  # noqa: E402
import env_room as R  # noqa: E402
import face as F  # noqa: E402
import materials as M  # noqa: E402
import props as P  # noqa: E402
import synergy as S  # noqa: E402
import s11_shutdown as S11  # noqa: E402  (hand-overs: HEADSET_REST, the head's yaw toward Pat)

V3 = Vector

SHOT = 's13'
INFO = next(s for s in json.load(open(os.path.join(HERE, 'shots.json'))) if s['id'] == SHOT)
START, END = INFO['start'], INFO['end']

# ---------------------------------------------------------------- the beats (film frames)
LIFT = START                # stage moves on f1249, f1265, f1281; the final rise lands on f1297
CONTACT = 1297              # the spout meets the chin plate; the sip; the fill starts
FILL_STEP, FILL_LEVEL = 1.45, 0.70
CLOSE = (1299, 1301)        # top row out, middle row out (closed: bottom row only)
OPEN = (1333, 1335)         # middle row back, top row back (full 2x3 from f1335)
TILT = (1305, 1344)         # gravity turns in the room's frame (into S14)
TILT_DEG = 4.0              # by the cut
SLAB_DX = 0.20              # the slab's slide across the walnut by the cut (m)
HEADSET_SLIDE = (1318, 1334)  # off screen: it breaks loose and slides a few cm downhill
HEADSET_DX = 0.035            # +X: downhill, away from the hub (S14 holds S11.HEADSET_REST + this)
# S11 holds his head yawed toward Pat to its cut; he turns back to the cup on the first step (f1249-1259)
HEAD_IN = (0.0, S.CANON_HEAD[1], S11.YAW_DEG)

# ---------------------------------------------------------------- camera
PUSH = 0.02                 # of the 1.9 m distance, linear over the shot
TOP_MARGIN = 0.075          # head apex this far (of the frame height) under the top edge

# ---------------------------------------------------------------- light (tuned on proof renders)
BOUNCE_E = 0.5
RIM_E = 26.0
# the flag: the slab reaches the breastplate (torso plates, blue chip, core) at this fraction of its
# strength, so the chest falls 2 stops under the head (light-linked: the head, arm, hand and cup keep
# the full slab, and the plates keep their own shadows and the slab edge's slide)
TORSO_SUN = 0.25
TORSO_BOUNCE = 0.25        # the walnut bounce on the same plates, of BOUNCE_E
EXPOSURE = 0.0             # the dark room: the slab-lit head is the brightest thing in frame
GLINT_E = 24.0             # rig.glass_glint strength (default 7): the skylight line just reads on the glass
PAT_DISC_PX = 72.0         # Pat's disc geometry, px across at 1600 (soft profile: ~55 px at half brightness)
PAT_GAIN = 0.7             # Pat's disc brightness, of front_bokeh's (it stays a faint grey)
# the second gravity cue: dust motes in the slab between the lens and him drift toward +X on the tilt
# A thin layer just in front of his face plane (1.6-1.75 m from the lens, inside the depth of field, so
# each mote is a steady sharp glint: defocused ones sample into blotches at 12 spp), in two boxes either
# side of the face glass, the left one ending DUST_DX + 3 cm short of it, so no mote ever crosses the
# black glass, where it would read as a stray LED.
DUST = [dict(name='s13_dust_l', center=(-0.58, 0.11, 1.46), size=(0.54, 0.18, 0.70), n=140, seed=13,
             radius=(0.0008, 0.0014)),
        dict(name='s13_dust_r', center=(0.36, 0.11, 1.46), size=(0.48, 0.18, 0.70), n=120, seed=14,
             radius=(0.0008, 0.0014))]
DUST_DX = 0.15             # their drift by the cut (m), on tilt_at's curve
VIGNETTE = dict(position=(0.5, 0.62), size=(1.0, 0.9), amount=0.5)   # centred on his face
BOKEH = dict(seed=5)
PAT_DISC = (0.85, 0.74)      # Pat's disc in the image (0..1, y up)

DIAG = bool(os.environ.get('S13_DIAG'))
_opts = json.loads(os.environ.get('S13_OPTS', '{}') or '{}')
for _k, _v in _opts.items():
    globals()[_k] = tuple(_v) if isinstance(_v, list) else _v


def linear_keys(obj, a=-1e9, b=1e9):
    ad = obj.animation_data
    if ad is None or ad.action is None:
        return
    for fc in C.fcurves(ad.action):
        for kp in fc.keyframe_points:
            if a <= kp.co.x <= b:
                kp.interpolation = 'LINEAR'


def tilt_at(f):
    """Gravity's turn in the room's frame, 0..1 of the cut's value: eased in from f1305 and
    still accelerating at the cut (S14 carries it on to 12 deg)."""
    t = max(0.0, (f - TILT[0]) / float(TILT[1] - TILT[0]))
    return t * t


# ---------------------------------------------------------------- the room's side of the film

def room_timeline(room):
    """The room as S11 leaves it (env_room.demo_timeline's hand-overs): every colleague dead
    except Pat (powered on at f1085), the printer stopped mid-sheet with its LED out, the droid
    parked at the foot with its pinlight out, the hub dark, the master cord sprung, Kevin's
    padlock on the walnut at his stop, everything else posted."""
    sc = bpy.context.scene
    T = room.terminals
    for nm in R.SHUTDOWN_ORDER:
        T[nm].off()                              # dead from the start of the shot
    T['pat'].power_on(1085)
    pr = room.printer
    pr.stop_mid(1049)
    pr.led_off(1049)
    d = room.droid
    d.place(START - 1, R.ROOM['droid_lane_x'], R.ROOM['droid_park_y'], R.ROOM['droid_start_heading'])
    d.light_off(1049)
    room.key_visible(d.binder, START - 1, False)
    for nm, i, f, dbl in R.S07_ARRIVALS:
        room.key_visible(room.props[nm][i], START - 1, False)
    pad = room.props['kevin'][0]
    pad.location = Vector((*R.stop_for('padlock', obj=pad, start=R.prop_home('kevin')), pad.location.z))
    room.hub.leds_off(961)
    room.master.pulled(961)
    room.set_state(START, 'dark')
    # the slab slides across the walnut as the room tilts: env_room.sun_drift's turn, re-keyed
    # every frame on the tilt's curve (eased in, still moving at the cut)
    room.sun_drift(TILT[0], TILT[1], SLAB_DX)
    for s in (room.sun, getattr(room, 'sun_table', None)):
        if s is None:
            continue
        fcs = [c for c in C.fcurves(s.animation_data.action) if c.data_path == 'rotation_euler']
        r0 = [c.evaluate(TILT[0]) for c in sorted(fcs, key=lambda c: c.array_index)]
        r1 = [c.evaluate(TILT[1]) for c in sorted(fcs, key=lambda c: c.array_index)]
        for c in fcs:
            while len(c.keyframe_points):
                c.keyframe_points.remove(c.keyframe_points[0], fast=True)
        for f in range(TILT[0] - 1, END + 3):
            k = tilt_at(f)
            s.rotation_euler = tuple(a + (b - a) * k for a, b in zip(r0, r1))
            s.keyframe_insert('rotation_euler', frame=f)
        linear_keys(s)
    sc.frame_set(START)


# ---------------------------------------------------------------- face

def face_timeline():
    tl = F.FaceTimeline(START, END)
    tl.fill(CONTACT, step=FILL_STEP, level=FILL_LEVEL)          # LED n on at f1297 + round(n x 1.45)
    # the eyes close from the top down to their bottom row, two frames a row, and reopen the same way
    tl.eyes_rows(CLOSE[0], CLOSE[1] - 1, (1, 2), close=1)
    tl.eyes_rows(CLOSE[1], OPEN[0] - 1, 'bottom', close=1)
    tl.eyes_rows(OPEN[0], OPEN[1] - 1, (1, 2), close=1)
    return tl


# ---------------------------------------------------------------- Synergy

def stage_synergy(tl):
    rig = S.build(timeline=tl, location=R.SYNERGY_POS)
    sp = Vector(R.SYNERGY_POS)
    k = 'CONSTANT'
    rig.rest(START - 1, k)
    rig.apply_preset(START - 1, 'idle_cup', k)
    rig.pose(START - 1, k, root_loc=tuple(sp), root_rot=0.0, head=HEAD_IN, neck=(0, 0, 0), badge=(0, 0, 0))
    smooth_sip(rig)
    rig.bake_pauldrons(START - 1, END + 2)
    return rig


def _elbow(rig, sol):
    """Shoulder and elbow (chest-rest space) of an arm solution."""
    b = rig.arm.data.bones
    ch = rig._arm_chain('R', *rig._arm_solution('R', sol['wrist'], sol['u'], sol['w'], sol['pole'], sol['shoulder']))
    return ch[0] @ b['upperarm_R'].head_local, ch[1] @ b['forearm_R'].head_local, ch


def smooth_sip(rig):
    """The four-beat lift on rig.sip's own path and timing (rig._sip_path: the cup level and clear
    of the breastplate every frame, tipping toward the face only on the final rise; stage moves
    f1249-1259, f1265-1275, f1281-1291, the final rise f1293-1297, CONSTANT holds between), but
    with the elbow travelling smoothly. Library workaround: rig.sip(1249) re-solves the elbow pole
    from a coarse candidate set on every frame, so the wrist runs smoothly while the elbow flicks
    10-20 cm between frames (f1268-1275, f1285-1288). Here the arm is solved once per stage (the
    hold poses: rig.sip_stage's solutions) and every in-between frame interpolates the elbow
    position and the shoulder offset between them with the stage's easing, the pole re-aimed
    through that elbow; the clearance of each frame is checked against the rig's own penetration
    test and printed."""
    T = rig.SIP_STAGE_T
    head = tuple(rig.SIP_HEAD)
    path = rig._sip_path(head)
    grip = rig.finger_angles('R', 'grip')
    thumb = rig.grip_angles('R')['thumb']
    def frame_at(t):
        base = path['base'](t)
        axis = path['axis'](t)
        wrist, u, w = rig.cup_hand_frame('R', base, axis, path['fdir'](t))
        return base, axis, wrist, u, w

    # anchors: idle (as hold_cup solves it) and each stage's hold pose (as sip_stage solves it)
    anchors = {}
    idle = S.IDLE_CUP
    sol0 = rig._cup_solution(V3(idle['cup_base']), V3(idle['finger_dir']), s='R', axis=S.UP, pole=V3(idle['pole']))
    anchors[0.0] = sol0
    for k in (1, 2, 2.5, 3):
        t = T[k]
        anchors[t] = rig._sip_arm(path['base'](t), path['fdir'](t), axis=path['axis'](t))
    elbows = {t: _elbow(rig, sol)[1] for t, sol in anchors.items()}
    segs = [(LIFT, LIFT + 10, T[0], T[1]), (LIFT + 16, LIFT + 26, T[1], T[2]), (LIFT + 32, LIFT + 42, T[2], T[2.5]),
            (CONTACT - 4, CONTACT, T[2.5], T[3])]
    keys = {}
    for f0, f1, t0, t1 in segs:
        a, z = anchors[t0], anchors[t1]
        for f in range(f0, f1 + 1):
            x = (f - f0) / float(f1 - f0)
            e = x * x * (3 - 2 * x)                    # rig.sip's easing
            t = t0 + (t1 - t0) * e
            base, axis, wrist, u, w = frame_at(t)
            sh = tuple(a['shoulder'][i] + (z['shoulder'][i] - a['shoulder'][i]) * e for i in range(3))
            E = elbows[t0].lerp(elbows[t1], e)
            pole = Vector(z['pole'])
            for _ in range(2):                         # aim the pole through the wanted elbow
                Sh, _E, _ = _elbow(rig, dict(wrist=wrist, u=u, w=w, pole=pole, shoulder=sh))
                ax = (wrist - Sh).normalized()
                v = E - Sh
                v = v - ax * v.dot(ax)
                if v.length > 1e-6:
                    pole = v.normalized()
            keys[f] = dict(base=base, axis=axis, wrist=wrist, u=u, w=w, pole=pole, shoulder=sh, t=t, e=e,
                           last=(f == f1), seg=segs.index((f0, f1, t0, t1)))
    prevE = None
    worst = (0.0, None)
    max_step = 0.0
    for f in sorted(keys):
        kf = keys[f]
        interp = 'CONSTANT' if kf['last'] and kf['seg'] < 3 else 'LINEAR'
        rig.place_arm(f, 'R', kf['wrist'], kf['u'], kf['w'], kf['pole'], interp, shoulder=kf['shoulder'])
        rig.pose(f, interp, fingers_R='grip', thumb_R='grip')
        if kf['seg'] == 0:
            # the first step also turns his face back from Pat (S11's yaw) to the cup, on the same easing
            hk = tuple(HEAD_IN[j] + (S.CANON_HEAD[j] - HEAD_IN[j]) * kf['e'] for j in range(3))
            rig.pose(f, interp, head=hk, neck=(0, 0, 0))
        if kf['seg'] == 3:
            hk = tuple(S.CANON_HEAD[j] + (head[j] - S.CANON_HEAD[j]) * kf['e'] for j in range(3))
            rig.pose(f, 'LINEAR', head=hk, neck=(0, 0, 0))
        chk = rig.solve_arm_clear('R', kf['wrist'], [(kf['u'], kf['w'])], [kf['pole']], [kf['shoulder']],
                                  fingers=grip, thumb=thumb, cup_arm=(kf['base'], kf['axis']))
        _, E, _ = _elbow(rig, kf)
        step = (E - prevE).length if prevE is not None else 0.0
        prevE = E
        if chk['pen'] > worst[0]:
            worst = (chk['pen'], f)
        max_step = max(max_step, step)
        if DIAG:
            print(f'S13 LIFT f{f} t {kf["t"]:.3f} elbow ({E.x:+.3f}, {E.y:+.3f}, {E.z:.3f}) step {step * 1000:5.1f} mm '
                  f'pen {chk["pen"]:.2e} reach {chk["reach"] * 1000:.2f} mm', flush=True)
    print('S13 LIFT: anchors elbow ' + ' '.join(f'{t:.2f}:({e.x:+.2f},{e.y:+.2f},{e.z:.2f})' for t, e in
                                               sorted(elbows.items())) +
          f'; largest elbow step {max_step * 1000:.1f} mm/frame; worst rig penetration score {worst[0]:.2e} '
          f'(f{worst[1]})', flush=True)
    return CONTACT


def headset_on_walnut(rig):
    """The headset exactly as S11 set it down (S11.HEADSET_REST, the headset empty's world location
    and rotation from f1150: standing on its earcups on the walnut beside the hub, 0.4 mm clear);
    off screen it breaks loose and slides HEADSET_DX downhill (+X, away from the hub) over
    f1318-1334. S14 holds the slid rest."""
    hs = rig.headset
    if hs is None:
        return None
    sc = bpy.context.scene
    rig.detach_headset(START - 20)
    loc, q = S11.HEADSET_REST
    rest = Vector(loc)
    hs.rotation_mode = 'QUATERNION'
    hs.location = rest
    hs.rotation_quaternion = Quaternion(q)
    hs.keyframe_insert('location', frame=START - 10)
    hs.keyframe_insert('rotation_quaternion', frame=START - 10)
    # library workaround: Rig._key_cord leaves every cord hook at (worn, route, unplugged) =
    # (1, 1, 1); the three Child Of constraints compound, so once the headset is far from his head
    # the cord hangs in the air beside his ear (f1249: hooks at z 1.43-1.58, the headset on the
    # walnut). Unplugged alone (0, 0, 1) wraps it round the left earcup, where it belongs.
    for e in rig.cord_hooks:
        for cn, v in (('worn', 0.0), ('route', 0.0), ('unplugged', 1.0)):
            if cn in e.constraints:
                con = e.constraints[cn]
                con.influence = v
                con.keyframe_insert('influence', frame=START - 10)
        for fc in C.fcurves(e.animation_data.action):
            for kp in fc.keyframe_points:
                if kp.co.x >= START - 10:
                    kp.interpolation = 'CONSTANT'
    for f in (START - 10, HEADSET_SLIDE[0]):
        hs.location = rest
        hs.keyframe_insert('location', frame=f)
    for f in range(HEADSET_SLIDE[0] + 1, HEADSET_SLIDE[1] + 1):
        t = (f - HEADSET_SLIDE[0]) / float(HEADSET_SLIDE[1] - HEADSET_SLIDE[0])
        hs.location = rest + Vector((HEADSET_DX * (1 - (1 - t) ** 2), 0.0, 0.0))   # breaks loose, friction stops it
        hs.keyframe_insert('location', frame=f)
    linear_keys(hs, HEADSET_SLIDE[0], HEADSET_SLIDE[1])
    sc.frame_set(START)
    dg = bpy.context.evaluated_depsgraph_get()
    low = (9.0, None)
    for o in [hs] + list(hs.children_recursive):
        if o.type != 'MESH' or 'cord' in o.name:
            continue
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        if len(me.vertices):
            z = min((ev.matrix_world @ v.co).z for v in me.vertices)
            if z < low[0]:
                low = (z, o.name)
        ev.to_mesh_clear()
    print(f'S13 HEADSET at S11.HEADSET_REST {tuple(round(c, 4) for c in rest)}: lowest vertex '
          f'{(low[0] - R.TABLE_TOP) * 1000:+.1f} mm over the walnut ({low[1]})', flush=True)
    return hs


def badge_swing(rig):
    """The badge hangs on its clip after gravity: a damped pendulum (7 cm) following the tilt
    toward his left (+X: rig 'badge' y > 0 lifts its left side, swinging the card's foot left),
    keyed every frame."""
    L = 0.07
    w0 = math.sqrt(9.81 / L)
    zeta = 0.12
    th, om = 0.0, 0.0
    sub = 20
    dt = 1.0 / C.FPS / sub
    rig.pose(TILT[0] - 1, 'LINEAR', badge=(0.0, 0.0, 0.0))
    for f in range(TILT[0], END + 3):
        for i in range(sub):
            g = TILT_DEG * tilt_at(f - 1 + (i + 1) / sub)
            acc = -w0 * w0 * (th - g) - 2 * zeta * w0 * om
            om += acc * dt
            th += om * dt
        rig.pose(f, 'LINEAR', badge=(0.0, th, 0.0))


# ---------------------------------------------------------------- camera

def camera(room, rig):
    f, cam = R.preview_camera(room, 's13_dark')       # 65 mm f/2.8, 1.35 m, 1.9 m, 8 deg to his right
    sc = bpy.context.scene
    sc.camera = cam
    loc = cam.location.copy()
    aim = Vector((R.SYNERGY_POS[0], R.SYNERGY_POS[1], 1.42))
    dn = (aim - loc).normalized()
    dist = (aim - loc).length
    for fr, k in ((START, 0.0), (END, PUSH)):
        cam.location = loc + dn * (dist * k)
        cam.keyframe_insert('location', frame=fr)
    linear_keys(cam)
    linear_extrap(cam)
    # focus on the face glass (the LEDs), held there through the head's 5 deg ease back
    sc.frame_set(START)
    foc = C.empty('s13_focus', None, tuple(rig.screen_point(0.5, 0.45, START)))
    for fr in (START, LIFT + 5, LIFT + 10, CONTACT - 4, CONTACT, END):
        foc.location = rig.screen_point(0.5, 0.45, fr)
        foc.keyframe_insert('location', frame=fr)
    cam.data.dof.focus_object = foc
    frame_shot(cam, rig)
    return cam


def frame_shot(cam, rig):
    """Lens shift (verticals stay as the approved framing has them) so the head's apex sits
    TOP_MARGIN of the frame height under the top edge at its highest (it rises a little as the
    head eases back and the lens pushes in); reports where the cup sits."""
    sc = bpy.context.scene
    res = sc.render.resolution_y / sc.render.resolution_x
    lens, sw = cam.data.lens, cam.data.sensor_width
    head = rig.parts_on_bones(['head'])
    cup = [o for o in rig.cup_objects() if o.type == 'MESH']

    def ys(objs, f):
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        Mi = cam.matrix_world.inverted()
        out = []
        for o in objs:
            if o.type != 'MESH':
                continue
            ev = o.evaluated_get(dg)
            me = ev.to_mesh()
            Mw = Mi @ ev.matrix_world
            for v in me.vertices:
                q = Mw @ v.co
                out.append((q.y / -q.z) * lens / sw)
            ev.to_mesh_clear()
        return out
    top = max(max(ys(head, f)) for f in (START, CONTACT, END))
    half = 0.5 * res
    shift = top + 2 * half * TOP_MARGIN - half
    cam.data.shift_y = shift
    for f in (START, CONTACT):
        c = ys(cup, f)
        print(f'S13 framing f{f}: cup {((min(c) - (shift - half)) / (2 * half)):.3f}-'
              f'{((max(c) - (shift - half)) / (2 * half)):.3f} of the frame height (0 = bottom edge)', flush=True)
    print(f'S13 framing: shift_y {shift:.4f}', flush=True)
    return shift


def linear_extrap(obj):
    ad = obj.animation_data
    if ad and ad.action:
        for fc in C.fcurves(ad.action):
            fc.extrapolation = 'LINEAR'


def glint(rig, cam):
    """The reflected skylight slot on the face glass, re-aimed through the head's turn back from
    Pat (f1249-1259) and its ease back (f1293-1297). GLINT_E: a thin skylight line that just reads
    along the top of the black glass at the shot's exposure (the card is built on the first call)."""
    for f in sorted({START, *range(LIFT, LIFT + 11), *range(CONTACT - 5, CONTACT + 1), END}):
        rig.glass_glint(cam, f, strength=GLINT_E)


def _soft_disc_mat():
    """Pat's disc: front_bokeh's emitter (its colour and level drivers) with a soft profile, full at
    the centre and smoothly to nothing at the rim: a distant screen's glow out of focus."""
    m = bpy.data.materials.new('s13_pat_disc')
    g = P.G(m, principled=False)
    u, v, _ = g.sep(g.uv())
    du, dv = g.sub(u, 0.5), g.sub(v, 0.5)
    r = g.mul(g.math('SQRT', g.add(g.mul(du, du), g.mul(dv, dv))), 2.0)
    prof = g.remap(r, 1.0, 0.30, smooth=True)
    e = g.node('ShaderNodeEmission')
    g._set(e.inputs['Color'], g.attr('bokeh_rgb').outputs['Color'])
    g._set(e.inputs['Strength'], g.mul(prof, g.attr('bokeh_k').outputs['Fac']))
    tr = g.node('ShaderNodeBsdfTransparent')
    add = g.node('ShaderNodeAddShader')
    g.L.new(tr.outputs[0], add.inputs[0])
    g.L.new(e.outputs[0], add.inputs[1])
    g.L.new(add.outputs[0], g.out.inputs['Surface'])
    m.cycles.emission_sampling = 'NONE'
    return m


def bokeh(room, cam):
    """Room.front_bokeh's discs behind him. Every colleague but Pat is dead for the whole shot, so
    their discs are left out; Pat's faint grey disc sits in the void on frame right, a little above
    his eye line (front_bokeh's default band puts it against the top edge in this framing)."""
    sc = bpy.context.scene
    discs = room.front_bokeh(cam, frame=START, **BOKEH)
    sc.frame_set(START)
    mw = cam.matrix_world
    cd = cam.data
    sw = cd.sensor_width
    sh = sw * sc.render.resolution_y / sc.render.resolution_x
    for o in discs:
        if o.get('bokeh_terminal') != 'pat':
            o.hide_render = True
            continue
        x, y = PAT_DISC
        loc = mw.translation
        D = (o.location - loc).length
        d = Vector(((x - 0.5 + cd.shift_x) * sw / cd.lens, (y - 0.5) * sh / cd.lens + cd.shift_y * sw / cd.lens, -1.0))
        dw = (mw.to_3x3() @ d).normalized()
        o.location = loc + dw * D
        o.rotation_euler = (-dw).to_track_quat('Z', 'Y').to_euler()
        # a distant defocused screen, not a speck: PAT_DISC_PX across at 1600, its own profile falling off
        # softly from the centre (no bokeh rim), plus this lens's defocus (~32 px): ~55 px at half brightness
        xs = [v.co.x for v in o.data.vertices]
        diam = max(xs) - min(xs)
        fpx = cd.lens / sw * 1600.0
        fl, fs = cd.lens / 1000.0, cd.dof.aperture_fstop
        Fd = (cd.dof.focus_object.matrix_world.translation - loc).length if cd.dof.focus_object else cd.dof.focus_distance
        blur = (fl * fl / (fs * max(Fd - fl, 1e-3))) * abs(D - Fd) / D / (sw / 1000.0) * 1600.0
        g_old = diam / D * fpx
        g_new = PAT_DISC_PX
        o.scale = (g_new / g_old,) * 3
        o.data.materials[0] = _soft_disc_mat()
        if PAT_GAIN != 1.0 and o.animation_data:
            for dr in o.animation_data.drivers:
                dr.driver.expression = f'{PAT_GAIN:.4f}*({dr.driver.expression})'
        print(f'S13 PAT disc: {D:.1f} m out, geometry {g_old:.0f} -> {g_new:.0f} px, defocus {blur:.0f} px '
              f'(at 1600)', flush=True)
    return discs


def dust(room):
    """The second gravity cue, in frame from the creak on: dust motes hanging in the slab between
    the lens and him (props.dust_motes: lit only where the slab catches them) on an empty that
    carries them toward +X (his left, frame right: downhill) on the tilt's own curve from f1305,
    DUST_DX by the cut. The boxes reach past the frame's edges, so it stays full of motes after the drift."""
    coll = C.collection('S13_dust')
    root = C.empty('s13_dust_drift', coll, (0.0, 0.0, 0.0))
    out = []
    for b in DUST:
        d = P.dust_motes(b['name'], coll, center=b['center'], size=b['size'], n=b['n'], f0=START - 4, f1=END + 4,
                         seed=b['seed'], radius=b['radius'])
        d.parent = root
        out.append(d)
    for f in range(TILT[0] - 1, END + 3):
        root.location = (DUST_DX * tilt_at(f), 0.0, 0.0)
        root.keyframe_insert('location', frame=f)
    linear_keys(root)
    return out


# ---------------------------------------------------------------- light

def torso_parts(rig):
    """The breastplate in this frame: the torso plates, the blue chip and the torso core (the parts
    on the chest and spine bones that are not the neck's A-frame, the collar, the lanyard or the
    badge, which hang in front of it and keep the full light), and his left shoulder (pauldron, hub,
    upper arm: the bottom right corner). The right arm, raised with the cup, keeps the full slab."""
    keep = ('neck', 'collar', 'lanyard', 'badge', 'clip', 'cable', 'piston', 'pauldron', 'shoulder')
    out = []
    for o in rig.parts_on_bones(['chest', 'spine']):
        if o.type == 'MESH' and not any(k in o.name.lower() for k in keep):
            out.append(o)
    for o in rig.parts_on_bones(['pauldron_L', 'shoulder_L', 'upperarm_L']):
        if o.type == 'MESH' and o not in out:
            out.append(o)
    for o in list(rig.torso_plates) + [rig.parts.get('blue_chip') if hasattr(rig, 'parts') else None]:
        if o is not None and o.type == 'MESH' and o not in out:
            out.append(o)
    return out


def _link(light, objs, name, state):
    coll = bpy.data.collections.new(name)
    for o in objs:
        coll.objects.link(o)
    for co in coll.collection_objects:
        co.light_linking.link_state = state
    light.light_linking.receiver_collection = coll
    return coll


def flag(room, rig, bounce, coll):
    """The flag over his chest (the treatment's chiaroscuro: the hard top light carves the head,
    darkness everywhere else): light linking, unseen and exact. The room's slab and the walnut
    bounce leave the breastplate out; a twin of each, at TORSO_SUN / TORSO_BOUNCE of its strength
    and on the same heading (the sun's twin follows its tilt every frame), lights only the
    breastplate. So the plates keep their shading, their shadows (the arm, the cup, the head's)
    and the slab edge's slide, two stops under the head; the head, arm, hand and cup are untouched."""
    parts = torso_parts(rig)
    print('S13 FLAG: ' + ', '.join(sorted(o.name for o in parts)), flush=True)
    _link(room.sun, parts, 'S13_sun_not_torso', 'EXCLUDE')
    twin = bpy.data.objects.new('s13_sun_torso', room.sun.data.copy())
    twin.data.energy = room.sun.data.energy * TORSO_SUN
    coll.objects.link(twin)
    twin.rotation_mode = room.sun.rotation_mode
    cn = twin.constraints.new('COPY_TRANSFORMS')
    cn.target = room.sun
    _link(twin, parts, 'S13_sun_torso_only', 'INCLUDE')
    _link(bounce, parts, 'S13_bounce_not_torso', 'EXCLUDE')
    bt = bpy.data.objects.new('s13_walnut_bounce_torso', bounce.data.copy())
    bt.data.energy = bounce.data.energy * TORSO_BOUNCE
    coll.objects.link(bt)
    bt.matrix_world = bounce.matrix_world.copy()
    for a in ('visible_camera', 'visible_glossy'):
        setattr(bt, a, getattr(bounce, a))
    _link(bt, parts, 'S13_bounce_torso_only', 'INCLUDE')
    return parts


def lights(room, rig):
    coll = C.collection('S13_light')
    sp = Vector(R.SYNERGY_POS)
    # the slab's warm bounce off the walnut in front of him
    b = C.area_light('s13_walnut_bounce', (sp.x, sp.y - 0.80, R.TABLE_TOP + 0.02), (sp.x, sp.y - 0.05, 1.22),
                     BOUNCE_E, 1.1, 0.5, color=(1.0, 0.84, 0.70), coll=coll)
    b.visible_camera = False
    b.visible_glossy = False
    bpy.context.view_layer.update()
    flag(room, rig, b, coll)
    # the slab's spill off the head wall behind him: crown, shoulder caps, the lid's far edge
    rim = C.area_light('s13_rim', (sp.x + 0.30, sp.y + 1.05, 2.45), (sp.x, sp.y, 1.50), RIM_E, 0.9, 0.35,
                       color=(0.86, 0.91, 1.0), coll=coll)
    rim.visible_camera = False
    return b, rim


def grade(sc):
    """The house look (room.compositor) with its vignette centred on his face, a touch deeper, so
    the slab-lit torso falls away under the head; the exposure comes down for the dark room."""
    sc.view_settings.exposure = EXPOSURE
    for n in sc.node_tree.nodes:
        if n.type == 'ELLIPSEMASK' and 'Position' in n.inputs:
            n.inputs['Position'].default_value = VIGNETTE['position']
            n.inputs['Size'].default_value = VIGNETTE['size']
        elif n.type == 'MIX_RGB' and n.blend_type == 'MULTIPLY':
            n.inputs['Fac'].default_value = VIGNETTE['amount']


# ---------------------------------------------------------------- diagnostics

def report(rig, cam):
    from bpy_extras.object_utils import world_to_camera_view
    sc = bpy.context.scene
    cup = [o for o in rig.cup_objects() if o.type == 'MESH']
    head = rig.parts_on_bones(['head'])
    for f in (START, 1259, 1265, 1275, 1281, 1291, CONTACT, END):
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        out = {}
        for nm, objs in (('cup', cup), ('head', head), ('badge', [rig.badge])):
            ys, xs = [], []
            for o in objs:
                ev = o.evaluated_get(dg)
                for c in ev.bound_box:
                    q = world_to_camera_view(sc, cam, ev.matrix_world @ Vector(c))
                    xs.append(q.x)
                    ys.append(q.y)
            out[nm] = (min(xs), max(xs), min(ys), max(ys))
        fp = world_to_camera_view(sc, cam, rig.screen_point(0.5, 0.5, f))
        print(f'S13 f{f}: ' + '  '.join(f'{k} x {v[0]:.2f}-{v[1]:.2f} y {v[2]:.2f}-{v[3]:.2f}' for k, v in out.items()) +
              f'  face ({fp.x:.2f}, {fp.y:.2f})', flush=True)


# ---------------------------------------------------------------- build

def build(args):
    t0 = time.time()
    sc = C.new_scene(START, END, args.quality, samples=args.samples, threads=args.threads)
    M.set_quality(args.quality)
    room = R.build(state='dark', seat_yaw_deg=R.SHOT_SEAT_YAW[SHOT])
    room_timeline(room)
    t1 = time.time()
    rig = stage_synergy(face_timeline())
    headset_on_walnut(rig)
    badge_swing(rig)
    t2 = time.time()
    cam = camera(room, rig)
    glint(rig, cam)
    lights(room, rig)
    dust(room)
    bokeh(room, cam)
    room.render_budget(kind='wide', samples=args.samples or None, locked=True)
    room.compositor()
    grade(sc)
    room.tune_scanlines(cam)
    sc.frame_set(START)
    if DIAG:
        report(rig, cam)
    print(f'S13 BUILD room {t1 - t0:.1f}s  synergy {t2 - t1:.1f}s  total {time.time() - t0:.1f}s', flush=True)
    return room, rig, cam


if __name__ == '__main__':
    a = C.shot_args()
    build(a)
    C.render(SHOT, a, START, END)
