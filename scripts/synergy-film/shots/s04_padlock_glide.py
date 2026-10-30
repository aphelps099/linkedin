"""S04 · f353-432 · E2_LONG_ROOM (lit): Kevin speaks; his padlock glides the table to a fingertip.

    blender -b --factory-startup -P shots/s04_padlock_glide.py -- --quality proof --only 353,377,388,410,418,424,432
    blender -b --factory-startup -P shots/s04_padlock_glide.py -- --quality animatic --step 8
    blender -b --factory-startup -P shots/s04_padlock_glide.py -- --quality final

The beats (film frames, 90 BPM = 16 frames a beat; TREATMENT.md S04):
  f353-376  Locked on the director's approved s04_start framing: lens 3 cm above the walnut,
            40 mm f/2.8, 0.5 m up-table of the scratched brass padlock, Kevin's sky-blue screen
            1.5 m behind it, Operations' orange disc far left. Kevin 'speaks': a pale band sweeps
            left to right across his field on each murmur burst (f353, f361, f369; 8 frames
            each), the whole field pulsing 25% brighter and dimmer; his pool rims the brass.
  f377      The padlock leaves home on its own: a smoothstep up to 8.3 m/s by f389, cruise
            (11.5 m to the fingertip in 47 frames, about 6 m/s on average). The camera rides
            with it at its speed looking back down the table (the approved s04_tabletop), Kevin
            and Operations receding as colour discs, the walnut doubling the brass.
  f388      It crosses the soft edge of the skylight slab: the brass flashes once (3 frames).
  f384-418  The camera swings round it through the spine side (trapezoid, at most 5.5 deg a
            frame), holding it low in frame: Keys' cobalt screen (f395) and Synthia's ivory
            (f408) pass behind the brass, the brass channel's yellow cords a line beneath it.
  f403-422  The pan eases from riding with the padlock to rest on the final frame (one cubic:
            it only ever slows down).
  f404-424  The dolly brakes harder than the padlock (quintic) and comes to rest on f424.
  f408      The padlock brakes: a constant deceleration to 0.3 m/s at the fingertip (S09's knock).
  f410-418  His left index lowers 24 cm onto the walnut in one clean eased 8-frame move (keyed
            every frame on a straight vertical) and rests at env_room's fingertip contract; the
            pan brings it into frame top right on f418, as it lands.
  f416-424  The padlock overtakes the braking camera from the left third into frame centre.
  f418-428  Rack focus from the padlock to the fingertip.
  f424      It stops dead against the fingertip (the knock), 1.5 mm short of contact, the
            finger unmoved; the camera is at rest.
  f425-432  Hold, locked: the padlock on the upper third, its mirror image in the walnut below,
            the hand from the top right, the hub's dark lobe and the yellow master cord at left.
Synergy: only the left hand and forearm read (his body sits above the frame top: a soft edge
of his waist cables and a hip plate show behind the hand); cup at chest height in the right
hand throughout, S03's shoulder shift held, breathing; no head move, no blink, idle mouth.
He never walks.

Light: the room as built (render_budget 'macro'), plus the padlock kit's warm card re-aimed
every frame to the brass face's mirror direction (it flares for the flash), and the slab's
warm walnut bounce on his hand and forearm (the rig owner's note), linked to them only.
"""

import json
import math
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'lib'))

import bpy  # noqa: E402
from mathutils import Euler, Vector  # noqa: E402

import common as C  # noqa: E402
import env_room as R  # noqa: E402
import face as F  # noqa: E402
import materials as M  # noqa: E402
import synergy as S  # noqa: E402

SHOT = 's04'
INFO = next(s for s in json.load(open(os.path.join(HERE, 'shots.json'))) if s['id'] == SHOT)
START, END = INFO['start'], INFO['end']

# ---------------------------------------------------------------- the beats (film frames)
SYLLABLES = ((353, 8), (361, 8), (369, 8))   # Kevin's three bands, on the murmur bursts (audio f353/361/369)
SPEAK_PULSE = 0.25          # the whole field pulses this much brighter and dimmer
SPEAK_BAND = 1.5            # band strength (props default 1.0): his screen sits soft behind the padlock
GLIDE = (377, 424)          # the padlock leaves home / stops dead against the fingertip (the knock)
DECEL = 408                 # it starts to brake
ACCEL = 12                  # frames it takes to reach cruise speed (smoothstep)
V_KNOCK = 0.0125            # m per frame (0.3 m/s) when it meets the fingertip: S09's knock
FINGER = (410, 418)         # his left index lowers into frame and rests on the walnut
RACK = (418, 428)           # focus padlock -> fingertip

# ---------------------------------------------------------------- camera (tuned on proof renders)
LENS, FSTOP = 40.0, 2.8
CAM_Z = 0.03                # lens height above the walnut
ORBIT = (384, 418)          # it swings round the padlock (trapezoid speed, RAMP of it easing each end)
RAMP = 0.35
BETA_END = 115.0            # its bearing round the padlock after the swing (deg from the travel line toward +X)
R_END = 0.50                # its distance from the padlock's line after the swing
BRAKE = (404, 424)          # the dolly brakes (quintic: comes to rest with no jolt) ...
LAG = 0.12                  # ... ending this far short of the stop along the travel line
AIM = (403, 422)            # the pan eases from riding with the padlock to the locked final frame
FRAME_RIDE = (0.12, -0.10, -0.03)  # padlock in frame while riding: tan right (looking back, beside), up
FRAME_END = (0.0, 0.09)     # stop in the final frame: on the upper third, its mirror image below,
                            # the frame top clear of his torso
HOVER = 0.24                # the fingertip starts this far above the walnut and lowers

# ---------------------------------------------------------------- light
BOUNCE_E = 4.0              # the slab's warm bounce off the walnut onto his hand and forearm
CARD_E, CARD_DIST, CARD_UP = 1.0, 0.55, 0.20
FLASH = 4.5                 # the card flares this many times over as the padlock enters the slab

HAND_L = ['hand_L'] + [f'{n}_{i}_L' for n in ('index', 'middle', 'ring', 'pinky') for i in (1, 2, 3)] + \
    [f'thumb_{i}_L' for i in range(3)]
ARM_L = HAND_L + ['forearm_L', 'upperarm_L']

def smoothstep(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def smoother(t):
    t = min(1.0, max(0.0, t))
    return t * t * t * (t * (6 * t - 15) + 10)


# ---------------------------------------------------------------- the glide

class Glide:
    """Distance travelled along the line home -> stop at any (fractional) film frame: a smoothstep
    ease up to cruise speed, cruise, then a constant deceleration from DECEL that meets the
    fingertip still moving at V_KNOCK on GLIDE[1], where it stops dead (the knock)."""

    def __init__(self, length):
        self.L = length
        f0, f1 = GLIDE
        self.ta = ACCEL
        self.td = f1 - DECEL
        self.vmax = (length - self.td * V_KNOCK / 2) / (self.ta / 2 + (DECEL - f0 - self.ta) + self.td / 2)

    def v(self, f):
        f0, f1 = GLIDE
        if f <= f0 or f >= f1:
            return 0.0
        if f < f0 + self.ta:
            return self.vmax * smoothstep((f - f0) / self.ta)
        if f < DECEL:
            return self.vmax
        return self.vmax + (V_KNOCK - self.vmax) * (f - DECEL) / self.td

    def s(self, f):
        f0, f1 = GLIDE
        if f <= f0:
            return 0.0
        if f >= f1:
            return self.L
        ta, vm = self.ta, self.vmax
        t = min(f - f0, ta) / ta
        s = vm * ta * (t ** 3 - t ** 4 / 2)
        if f <= f0 + ta:
            return s
        s += vm * (min(f, DECEL) - (f0 + ta))
        if f <= DECEL:
            return s
        u = f - DECEL
        return s + vm * u + (V_KNOCK - vm) * u * u / (2 * self.td)


# ---------------------------------------------------------------- the room's side of the film

def room_timeline(room):
    """env_room.demo_timeline's events that touch f353-432, so every continuity state is the one
    S03 leaves and S05 picks up (printer feeds on the bars, the droid's run up its lane)."""
    pr = room.printer
    for f in (257, 321, 385, 449):
        pr.feed(f)
    pr.led_pulse(1, 1048)
    d = room.droid
    d.blink(1, 1440, 48)
    lane = R.ROOM['droid_lane_x']
    x0, y0 = R.ROOM['droid_start']
    d.place(299, x0, y0, R.ROOM['droid_start_heading'])
    d.drive(300, 712, [(x0, y0), (x0, y0 + 1.2), (lane, -26.0), (lane, -8.0)] + R.droid_handoff_path(lane)[1:],
            ease='cruise', accel=0.04)


def kevin_speaks(t):
    """Three pale bands sweep left to right across Kevin's field, one per murmur burst, while the
    whole field pulses about +-25% (props.Terminal.speak's grammar, keyed on the sound's frames;
    the band a touch stronger, since his screen sits soft 1.5 m behind the padlock)."""
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


# ---------------------------------------------------------------- Synergy

def stage_synergy(tl):
    """Standing at the head, cup at chest height in the right hand (S03's pose, its shoulder shift
    held), breathing. The left hand comes up off screen and its index lowers onto the walnut
    in one clean 8-frame move, keyed every frame on a straight vertical line."""
    rig = S.build(timeline=tl, location=R.SYNERGY_POS)
    k = 'BEZIER'
    rig.apply_preset(START, 'idle_cup', k)
    rig.pose(START, k, shoulder_L=(0.6, 2.0, 0.0))          # S03's attentive shoulder shift, held
    rig.breathe(START, END)
    tip = Vector(R.ROOM['fingertip_L'])
    # off screen (his arm is out of every frame until f418): the relaxed arm comes up and
    # forward to the hover above the stop
    lift0, lift1 = 382, 404
    rig.relaxed_arm(lift0, 'L', k)
    rig.pose(lift0, k, shoulder_L=(0.6, 2.0, 0.0))
    for f in range(FINGER[0], FINGER[1] + 1):
        h = HOVER * (1.0 - C.ease((f - FINGER[0]) / (FINGER[1] - FINGER[0])))
        rig.reach_L(f, tip=tuple(tip + Vector((0, 0, h))), interp='LINEAR', table_z=R.TABLE_TOP + h)
    rig.reach_L(lift1, tip=tuple(tip + Vector((0, 0, HOVER))), interp=k, table_z=R.TABLE_TOP + HOVER)
    rig.reach_L(END, interp=k)
    rig.bake_pauldrons(START, END)
    return rig


# ---------------------------------------------------------------- camera

def heading_pitch(d):
    return math.atan2(-d.x, d.y), math.atan2(d.z, Vector((d.x, d.y)).length)


def cam_rot(heading, pitch):
    """Camera rotation looking along heading (0 = +Y, + toward -X) and pitch, horizon level."""
    return Euler((math.pi / 2 + pitch, 0.0, heading), 'XYZ')


def trap(t, r=RAMP):
    """0..1 ramp whose speed is a trapezoid: eased over the first and last `r` of it."""
    t = min(1.0, max(0.0, t))
    vm = 1.0 / (1.0 - r)
    if t < r:
        return vm * t * t / (2 * r)
    if t > 1 - r:
        return 1.0 - vm * (1 - t) ** 2 / (2 * r)
    return vm * (t - r / 2)


class CameraMove:
    """Lens 3 cm above the walnut, 40 mm f/2.8, keyed every frame (linear, so motion blur sees the
    true moves). Locked on the approved s04_start framing while Kevin speaks (padlock 0.5 m away,
    Kevin's screen behind it). From f377 it rides with the padlock at its speed (the approved
    s04_tabletop look back down the table, the colleagues receding as colour discs), then swings
    round it through the spine side to beside-and-behind it (Keys' cobalt and Synthia's ivory
    pass behind the brass), always holding it low in frame. From f404 the dolly brakes harder
    than the padlock and comes to rest on f424; from f403 the pan eases off and locks on f422,
    so the padlock overtakes into frame centre, where the fingertip is waiting."""

    def __init__(self, room, glide, home, stop):
        self.glide, self.home, self.stop = glide, home, stop
        self.tz = R.TABLE_TOP
        self.u = (stop - home).normalized()
        self.n = Vector((self.u.y, -self.u.x))           # right of the travel line (+X side)
        _, ref = R.preview_camera(room, 's04_start')
        bpy.context.view_layer.update()
        self.ref_loc = ref.matrix_world.translation.copy()
        ref_dir = ref.matrix_world.to_3x3() @ Vector((0, 0, -1))
        off0 = (self.ref_loc - self.pad(START)).to_2d()
        self.b0 = math.degrees(math.atan2(off0.dot(self.n), off0.dot(self.u)))
        self.r0 = off0.length
        h_ref, p_ref = heading_pitch(ref_dir)
        h_pad, p_pad = heading_pitch(self.pad(START) - self.ref_loc)
        self.dh0, self.dp0 = h_ref - h_pad, p_ref - p_pad
        # the preview's own camera and focus empty are not needed
        for o in (ref, bpy.data.objects.get('focus_s04_start')):
            if o is not None:
                bpy.data.objects.remove(o)
        # the dolly's brake: a quintic from the riding state to rest at L - LAG
        f0, f1 = BRAKE
        self.s0 = glide.s(f0)
        self.V = (glide.s(f0 + 0.01) - glide.s(f0 - 0.01)) / 0.02 * (f1 - f0)
        self.s1 = glide.L - LAG
        self.end = self.position(END)
        self.h_end, self.p_end = heading_pitch(self.pad(END) - self.end)
        self.h_end += math.atan(FRAME_END[0])
        self.p_end -= math.atan(FRAME_END[1])

    def pad(self, f):
        p = self.home + self.u * self.glide.s(min(f, GLIDE[1]))
        return Vector((p.x, p.y, self.tz + 0.045))           # the padlock body's centre

    def s_cam(self, f):
        f0, f1 = BRAKE
        if f <= f0:
            return self.glide.s(f)
        t = min(1.0, (f - f0) / (f1 - f0))
        return (self.s0 * (1 - 10 * t ** 3 + 15 * t ** 4 - 6 * t ** 5) +
                self.V * (t - 6 * t ** 3 + 8 * t ** 4 - 3 * t ** 5) +
                self.s1 * (10 * t ** 3 - 15 * t ** 4 + 6 * t ** 5))

    @staticmethod
    def orbit(f):
        return trap((f - ORBIT[0]) / (ORBIT[1] - ORBIT[0]))

    def position(self, f):
        if f <= GLIDE[0]:
            return self.ref_loc.copy()
        b = math.radians(self.b0 + (BETA_END - self.b0) * self.orbit(f))
        r = self.r0 + (R_END - self.r0) * smoother((f - GLIDE[0]) / (BRAKE[1] - GLIDE[0]))
        p = self.home + self.u * self.s_cam(f) + (self.n * math.sin(b) + self.u * math.cos(b)) * r
        return Vector((p.x, p.y, self.tz + CAM_Z))

    def ride_aim(self, f):
        """(heading, pitch) riding with the padlock: from the approved framing's offsets into the
        riding ones (looking back: a little right of it; beside it: lead room ahead of it)."""
        hp, pp = heading_pitch(self.pad(f) - self.position(f))
        a = smoother((f - GLIDE[0]) / 12.0)
        o = smoother(self.orbit(f))
        x = FRAME_RIDE[0] * (1 - o) + FRAME_RIDE[1] * o
        return (hp + self.dh0 * (1 - a) + math.atan(x) * a,
                pp + self.dp0 * (1 - a) - math.atan(FRAME_RIDE[2]) * a)

    def aim(self, f):
        """(heading, pitch): riding until AIM[0], then one cubic ease from the riding pan (its
        position and speed there) to rest on the locked final frame at AIM[1], so the pan only
        ever slows down while the padlock overtakes into frame centre."""
        if f <= AIM[0]:
            return self.ride_aim(f)
        if not hasattr(self, '_h0'):
            f0 = AIM[0]
            self._h0, self._p0 = self.ride_aim(f0)
            self._dh = self.ride_aim(f0 + 0.5)[0] - self.ride_aim(f0 - 0.5)[0]
            he = self.h_end
            while he - self._h0 > math.pi:
                he -= 2 * math.pi
            while he - self._h0 < -math.pi:
                he += 2 * math.pi
            self._he = he
        T = AIM[1] - AIM[0]
        t = min(1.0, (f - AIM[0]) / T)
        h = (self._h0 * (2 * t ** 3 - 3 * t ** 2 + 1) + self._dh * T * (t ** 3 - 2 * t ** 2 + t) +
             self._he * (-2 * t ** 3 + 3 * t ** 2))
        w = smoother(t)
        return h, self._p0 * (1 - w) + self.p_end * w

    def key(self, cam, foc):
        prev = None
        for f in range(START, END + 1):
            loc = self.position(f)
            h, p = self.aim(f)
            if prev is not None:
                while h - prev > math.pi:
                    h -= 2 * math.pi
                while h - prev < -math.pi:
                    h += 2 * math.pi
            prev = h
            cam.location = loc
            cam.rotation_euler = cam_rot(h, p)
            cam.keyframe_insert('location', frame=f)
            cam.keyframe_insert('rotation_euler', frame=f)
            # focus rides on the padlock, then racks to the fingertip
            a = C.ease((f - RACK[0]) / (RACK[1] - RACK[0]))
            foc.location = self.pad(f).lerp(Vector(R.ROOM['fingertip_L']) + Vector((0.0, 0.006, 0.004)), a)
            foc.keyframe_insert('location', frame=f)
        for o in (cam, foc):
            for fc in C.fcurves(o.animation_data.action):
                for kp in fc.keyframe_points:
                    kp.interpolation = 'LINEAR'


def camera_move(room, glide, home, stop):
    mv = CameraMove(room, glide, home, stop)
    cam = C.camera('cam_s04', LENS, tuple(mv.ref_loc), None, fstop=FSTOP, clip=(0.005, 200.0))
    foc = C.empty('focus_s04', None, tuple(mv.pad(START)))
    cam.data.dof.focus_object = foc
    mv.key(cam, foc)
    bpy.context.scene.camera = cam
    return cam, mv


# ---------------------------------------------------------------- light

def walnut_bounce(rig):
    """The slab's warm bounce off the walnut (rig owner's note): lifts the back of his hand and
    his forearm. Invisible to camera and glossy rays, linked to the left arm only (his body
    stays dark above the frame top)."""
    sp = Vector(R.SYNERGY_POS)
    lt = C.area_light('s04_walnut_bounce', (sp.x + 0.15, sp.y - 0.80, R.TABLE_TOP + 0.02),
                      (sp.x + 0.20, sp.y - 0.25, 1.05), BOUNCE_E, 1.1, 0.5, color=(1.0, 0.84, 0.70),
                      coll=C.collection('S04_light'))
    lt.visible_camera = False
    lt.visible_glossy = False
    recv = bpy.data.collections.new('S04_bounce_receivers')
    for o in rig.parts_on_bones(ARM_L):
        recv.objects.link(o)
    lt.light_linking.receiver_collection = recv
    return lt


def slab_entry(glide, home, stop):
    """Fractional film frame at which the padlock's centre crosses the slab's soft edge."""
    u = (stop - home).normalized()
    edge = -R.ROOM['skylight_w'] / 2
    s_edge = (edge - home.x) / u.x
    f = float(GLIDE[0])
    while glide.s(f) < s_edge and f < GLIDE[1]:
        f += 0.05
    return f


def padlock_card(room, pad, cam, flash_frame):
    """The padlock kit's warm card (light-linked to the padlock, riding with it), re-aimed every
    frame to where the broad face we see mirrors it, so the brass reads as a warm face. It flares
    once as the padlock crosses into the skylight slab (the treatment's flash)."""
    card = room.insert_lights('padlock', target=pad)['card']
    card.parent = None
    fc = int(round(flash_frame))
    for f, k in ((fc - 2, 1.0), (fc, FLASH), (fc + 1, FLASH * 0.6), (fc + 4, 1.0)):
        card.data.energy = CARD_E * k
        card.data.keyframe_insert('energy', frame=f)
    sc = bpy.context.scene
    for f in range(START, END + 1):
        sc.frame_set(f)
        p = pad.matrix_world.translation.copy()
        c = cam.matrix_world.translation - p
        c = Vector((c.x, c.y, 0.0)).normalized()
        nrm = pad.matrix_world.to_3x3() @ Vector((0.0, 1.0, 0.0))
        nrm = Vector((nrm.x, nrm.y, 0.0)).normalized()
        if nrm.dot(c) < 0:
            nrm = -nrm
        mirror = (nrm * (2.0 * nrm.dot(c)) - c).normalized()
        pos = p + mirror * CARD_DIST + Vector((0.0, 0.0, CARD_UP))
        aim = (p + Vector((0.0, 0.0, 0.03))) - pos
        rot = aim.to_track_quat('-Z', 'Y').to_matrix()
        card.location = pos
        card.rotation_euler = rot.to_euler('XYZ', card.rotation_euler)
        card.keyframe_insert('location', frame=f)
        card.keyframe_insert('rotation_euler', frame=f)
    return card


def report(rig, cam, pad, stop):
    """Measured sync points: where the padlock and the fingertip sit in frame, and the first frame
    any of his hand shows."""
    from bpy_extras.object_utils import world_to_camera_view
    sc = bpy.context.scene
    tip = Vector(R.ROOM['fingertip_L'])
    hand = rig.parts_on_bones(HAND_L)
    first = None
    for f in range(FINGER[0] - 6, END + 1):
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        for o in hand:
            ev = o.evaluated_get(dg)
            mw = ev.matrix_world
            if any(0.0 <= q.x <= 1.0 and 0.0 <= q.y <= 1.0 and q.z > 0
                   for q in (world_to_camera_view(sc, cam, mw @ v.co) for v in list(ev.data.vertices)[::7])):
                first = f
                break
        if first is not None:
            break
    print(f'S04 hand first in frame f{first}', flush=True)
    for f in (START, GLIDE[0], 390, 400, DECEL, FINGER[0], 416, FINGER[1], GLIDE[1], END):
        sc.frame_set(f)
        q = world_to_camera_view(sc, cam, pad.matrix_world.translation + Vector((0, 0, 0.045)))
        t = world_to_camera_view(sc, cam, tip)
        print(f'S04 f{f} padlock at image ({q.x:.3f}, {q.y:.3f}) d={q.z:.3f}; fingertip at ({t.x:.3f}, {t.y:.3f})',
              flush=True)


def build(args):
    sc = C.new_scene(START, END, args.quality, samples=args.samples, threads=args.threads)
    M.set_quality(args.quality)
    room = R.build(state='lit', seat_yaw_deg=R.SHOT_SEAT_YAW[SHOT])
    room_timeline(room)
    kevin_speaks(room.terminals['kevin'])
    tl = F.FaceTimeline(START, END)
    rig = stage_synergy(tl)
    pad = room.props['kevin'][0]
    home = Vector(R.prop_home('kevin'))
    sc.frame_set(END)
    contract = Vector(R.stop_for('padlock', obj=pad, start=tuple(home)))
    stop = Vector(R.stop_for('padlock', obj=pad, start=tuple(home), hand=rig.parts_on_bones(HAND_L)))
    glide = Glide((stop - home).length)
    u = (stop - home).normalized()
    z = pad.location.z
    for f in range(GLIDE[0] - 1, GLIDE[1] + 1):
        p = home + u * glide.s(f)
        pad.location = (p.x, p.y, z)
        pad.keyframe_insert('location', frame=f)
    pad.keyframe_insert('location', frame=END)
    for fc in C.fcurves(pad.animation_data.action):
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'
    print(f'S04 glide {glide.L:.3f} m, cruise {glide.vmax * C.FPS:.2f} m/s, knock {V_KNOCK * C.FPS:.2f} m/s; '
          f'stop {tuple(round(x, 4) for x in stop)} (contract {tuple(round(x, 4) for x in contract)})', flush=True)
    cam, mv = camera_move(room, glide, home, stop)
    room.use_kits('padlock')
    flash = slab_entry(glide, home, stop)
    print(f'S04 the padlock crosses the slab edge at f{flash:.1f}', flush=True)
    padlock_card(room, pad, cam, flash)
    walnut_bounce(rig)
    room.render_budget(kind='macro', samples=args.samples or None)
    room.compositor(threshold=1.6)
    room.tune_scanlines(cam)
    sc.view_settings.exposure = 0.0
    report(rig, cam, pad, stop)
    return room, rig, cam


if __name__ == '__main__':
    a = C.shot_args()
    build(a)
    C.render(SHOT, a, START, END)
