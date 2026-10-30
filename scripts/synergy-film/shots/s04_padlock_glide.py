"""S04 · f353-432 · E2_LONG_ROOM (lit): Kevin speaks; his padlock glides the table to a fingertip.

    blender -b --factory-startup -P shots/s04_padlock_glide.py -- --quality proof --only 353,377,388,410,418,424,432
    blender -b --factory-startup -P shots/s04_padlock_glide.py -- --quality animatic --step 8
    blender -b --factory-startup -P shots/s04_padlock_glide.py -- --quality final

The beats (film frames, 90 BPM = 16 frames a beat; TREATMENT.md S04):
  f353-376  The director's approved s04_start framing on the cut (lens 3 cm above the walnut,
            40 mm f/2.8, 0.5 m up-table of the scratched brass padlock, Kevin's sky-blue screen
            1.5 m behind it). Kevin 'speaks': a pale band sweeps left to right across his field
            on each murmur burst (f353, f361, f369; 8 frames each), the field pulsing 25%; a
            sky-blue card rims the brass. From f359 the camera eases into one slow arc round
            the padlock toward the spine side: his screen slides out from behind the brass
            (centre on f353, a quarter in from the left on f376) so the bands read.
  f377      The padlock leaves home on its own: a smoothstep up to 8.3 m/s by f389, cruise,
            11.5 m to the fingertip in 47 frames (5.9 m/s on average; see NOTE). It turns half
            a turn as it glides (clockwise, eased), so its broad face never turns more than
            47 deg from the lens and arrives square to the finger, as in S09.
  f377-414  The camera rides with it at its speed, 3 cm over the walnut, low in frame (y 0.40),
            and finishes the arc behind and beside it (150 deg round from the travel line), so
            from f408 the lens looks up the table at the stop: the walnut doubling the brass,
            Keys' cobalt (f395) and Synthia's ivory (f407) streaking across the brass. One
            heading curve, monotonic from the cut to the lock (never reverses), at most
            4.5 deg a frame (see NOTE), with a 0.35 shutter through its fast part (f384-404).
  f388      It crosses the soft edge of the skylight slab: the brass flashes once (3 frames).
  f398      His left hand is already hovering 34 cm over the stop (it came up off frame); it
            comes into frame top right on the arc's ease-out (first in frame on f407), still.
  f408      The padlock brakes: a constant deceleration to 0.3 m/s at the fingertip (S09's knock).
  f410-418  His left index lowers 34 cm onto the walnut in one clean eased 8-frame move, on a
            straight vertical, in a settled frame (tip at image (0.84, 0.58) on f410), and rests
            on env_room's fingertip contract (its underside 1 mm over the walnut).
  f416-424  The dolly brakes harder than the padlock and comes to rest on f424, so the padlock
            pulls ahead and overtakes from the left third into frame centre.
  f418-428  Rack focus from the padlock (0.5 m) to the fingertip (0.95 m on f418).
  f424      It stops dead against the fingertip (the knock), 1.5 mm short of contact, its slide
            line 22 mm to his right of the tip (S09's contact: the brass meets it with its
            camera-right shoulder); the camera is at rest.
  f425-432  Hold, locked (fixed sampling seed): the padlock at frame centre, its mirror image in
            the walnut below, the bronze tip at its right shoulder, the back of his hand and his
            forearm from the top right, terminal-colour discs in the dark above.

Synergy: only his left forearm, hand and fingers are seen (the treatment). From a lens 3 cm over
the walnut looking up the table his thighs and pelvis sit on the walnut horizon right behind
the stop and his chest above it, so every other part of him, his cup included, is hidden from
camera and glossy rays in this shot (they still cast shadows and bounce light); his upper arm is
a holdout (black), and the head wall is hidden from camera rays (room.front_bokeh), so the lit
forearm runs up into the dark instead of ending in a cut. Cup at
chest height in the right hand throughout (unchanged, off frame), S03's shoulder shift held,
breathing; no head move, no blink, idle mouth. He never walks.

Light: the room as built (render_budget 'macro'); the padlock kit's warm card re-aimed every
frame to the brass face's mirror direction (it flares for the slab flash); a sky-blue rim card
for Kevin's speech and a cobalt and an ivory card for the two pass-bys (glossy, padlock only);
the slab's warm walnut bounce on his hand and forearm (the rig owner's note); terminal-colour
streak cards and a cool band that only the walnut mirrors, for this lens; the hub's mic LEDs
hidden from this lens and the sun's sheen kept off the hub (its cropped lobe stays black); the
walnut's base colour held warm brown for this lens (the slab-lit coat by the lens read mauve
against S03's walnut at the cut).

NOTE (numbers that differ from the treatment, kept on purpose):
  * cruise 8.3 m/s, not 'about 6 m/s': 11.5 m in 47 frames with a 12-frame smoothstep start and
    a 16-frame brake to S09's 0.3 m/s knock averages 5.9 m/s. The drag hiss runs f377-424.
  * pan peak 4.5 deg a frame, not <= 2.5: the approved s04_start looks back down the table
    (heading 155 deg) and the f410 beat needs the lens looking up it (heading 19 deg): 136 deg of
    pan between the cut and f410 is at least 54 frames at 2.5 deg a frame with no easing, and
    Kevin's screen must stay in frame to f376, so most of it lands in f377-410.
  * the padlock rides at y 0.40 (lower third is y 0.33): any lower and the hovering fingertip
    leaves the top of frame on f410 (the hover is only 4-7 deg over the walnut horizon at 2.6 m).
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
SPEAK_BAND = 2.6            # band strength (props default 1.0): it has to read on the slivers of
                            # his screen beside the brass and through the shackle
GLIDE = (377, 424)          # the padlock leaves home / stops dead against the fingertip (the knock)
DECEL = 408                 # it starts to brake
ACCEL = 12                  # frames it takes to reach cruise speed (smoothstep)
V_KNOCK = 0.0125            # m per frame (0.3 m/s) when it meets the fingertip: S09's knock
SLIDE_OFFSET = 0.022        # its slide line runs this far to his right (-X) of the tip: S09's contact
TURN = 180.0                # degrees it turns (clockwise from above) on its glide: broad face to the lens
FINGER = (410, 418)         # his left index lowers in frame and rests on the walnut
HOVER = 0.34                # the fingertip hovers this far above the walnut until FINGER[0]
LIFT = (380, 398)           # the arm comes up off frame to the hover (intermediate keys, baked caps)
TIP_DROP = 0.0018           # the reach contract leaves the index underside 2.8 mm up: lower it to 1 mm
RACK = (418, 428)           # focus padlock -> fingertip
LOCKED = 424                # camera, padlock and hand at rest from here: fixed sampling seed

# ---------------------------------------------------------------- camera (tuned in r1/tools/design.py)
LENS, FSTOP = 40.0, 2.8
CAM_Z = 0.03                # lens height above the walnut
ORBIT = (359, 414)          # the arc round the padlock (speed trapezoid with these eases)
EASE_IN, EASE_OUT = 30, 18
BETA_END = 150.0            # bearing round the padlock after the arc (deg from the travel line toward +X)
R_END = 0.50                # distance from the padlock after the arc
BRAKE = (416, 424)          # the dolly's speed falls from the padlock's to 0 (smootherstep of it)
# where the padlock sits in frame (x, y from the bottom left) while the heading follows it; after
# ORBIT[1] the heading and pitch ease (one cubic each) to the final frame at FRAME_X/Y[-1]
FRAME_X = [(353, 0.50), (362, 0.50), (376, 0.58), (386, 0.56), (396, 0.52), (414, 0.30), (424, 0.46)]
FRAME_Y = [(353, 0.512), (366, 0.512), (384, 0.40), (414, 0.40), (424, 0.50)]
SHUTTER_RIDE = 0.35         # motion blur shutter through the fast part of the arc (0.5 elsewhere)
SHUTTER_SPAN = (382, 404)

# ---------------------------------------------------------------- light
BOUNCE_E = 3.0              # the slab's warm bounce off the walnut onto his hand and forearm
CARD_E, CARD_DIST, CARD_UP = 1.0, 0.55, 0.20
FLASH = 4.5                 # the card flares this many times over as the padlock enters the slab
RIM_E = 0.9                 # Kevin's sky-blue rim on the brass while he speaks
PASS = (('keys', 395, 1.1), ('synthia', 407, 0.8))   # colour pass-bys on the brass: terminal, frame, gain
STREAK_E = 0.15             # walnut-only streak cards for this lens (glossy only)
BAND_E = 0.25               # walnut-only cool band (the slab's spill on the head wall)
WALNUT_TINT = (0.76, 0.86, 0.60)   # S04's walnut base colour multiplier (warm brown, toward S03's walnut)

ARM_SHOWN = (['forearm_L', 'hand_L'] + [f'{n}_{i}_L' for n in ('index', 'middle', 'ring', 'pinky') for i in (1, 2, 3)] +
             [f'thumb_{i}_L' for i in range(3)])
HAND_L = ['hand_L'] + [f'{n}_{i}_L' for n in ('index', 'middle', 'ring', 'pinky') for i in (1, 2, 3)] + \
    [f'thumb_{i}_L' for i in range(3)]


def smoothstep(t):
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def smoother(t):
    t = min(1.0, max(0.0, t))
    return t * t * t * (t * (6 * t - 15) + 10)


def curve(keys, f):
    """Piecewise smootherstep through (frame, value) keys (flat at every key: no overshoot)."""
    if f <= keys[0][0]:
        return keys[0][1]
    for (fa, va), (fb, vb) in zip(keys, keys[1:]):
        if f <= fb:
            return va + (vb - va) * smoother((f - fa) / (fb - fa))
    return keys[-1][1]


def trap(f, f0, f1, ein, eout):
    """0..1 over f0..f1 whose speed is a trapezoid: ramps up over ein frames, down over eout."""
    T = f1 - f0
    vm = 1.0 / (T - ein / 2.0 - eout / 2.0)
    t = f - f0
    if t <= 0:
        return 0.0
    if t >= T:
        return 1.0
    if t < ein:
        return vm * t * t / (2.0 * ein)
    if t > T - eout:
        return 1.0 - vm * (T - t) ** 2 / (2.0 * eout)
    return vm * (ein / 2.0 + (t - ein))


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
        return (self.s(f + 0.005) - self.s(f - 0.005)) / 0.01

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
    the band stronger, since his screen sits soft 1.5 m behind the padlock)."""
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
    held), breathing. The left arm comes up off frame (keyed through intermediate reaches, the
    shoulder caps baked) to hover the index 34 cm over the stop by LIFT[1], holds, and lowers it
    onto the walnut in one clean 8-frame move, keyed every frame on a straight vertical."""
    rig = S.build(timeline=tl, location=R.SYNERGY_POS)
    k = 'BEZIER'
    rig.apply_preset(START, 'idle_cup', k)
    rig.pose(START, k, shoulder_L=(0.6, 2.0, 0.0))          # S03's attentive shoulder shift, held
    rig.breathe(START, END)
    tz = R.TABLE_TOP - TIP_DROP
    tip = Vector(R.ROOM['fingertip_L']) - Vector((0.0, 0.0, TIP_DROP))
    # off frame: the relaxed arm comes up and forward to the hover above the stop
    rig.relaxed_arm(LIFT[0], 'L', k)
    rig.pose(LIFT[0], k, shoulder_L=(0.6, 2.0, 0.0))
    hover = tip + Vector((0.0, 0.0, HOVER))
    for f, a, b in ((LIFT[0] + 6, Vector((0.40, 0.16, 0.93)), 0.0), (LIFT[0] + 12, None, 0.55)):
        p = a if a is not None else Vector((0.40, 0.16, 0.93)).lerp(hover, b)
        rig.reach_L(f, tip=tuple(p), interp=k, table_z=p.z - (tip.z - tz))
    rig.reach_L(LIFT[1], tip=tuple(hover), interp=k, table_z=tz + HOVER)
    rig.reach_L(FINGER[0] - 1, tip=tuple(hover), interp=k, table_z=tz + HOVER)
    for f in range(FINGER[0], FINGER[1] + 1):
        h = HOVER * (1.0 - smoother((f - FINGER[0]) / (FINGER[1] - FINGER[0])))
        rig.reach_L(f, tip=tuple(tip + Vector((0, 0, h))), interp='LINEAR', table_z=tz + h)
    rig.reach_L(END, tip=tuple(tip), interp=k, table_z=tz)
    rig.bake_pauldrons(START, END)
    return rig


def hide_rest_of_him(rig):
    """Everything of him but the left arm: off for camera and glossy rays (still shadowing and
    bouncing light). The upper arm is a holdout instead (black, off for glossy rays): the lit
    forearm runs up into a dark arm, never into a cut end, and it blends into the dark void
    where the hidden body would be. Returns (shown, hidden)."""
    shown = set(rig.parts_on_bones(ARM_SHOWN))
    upper = [o for o in rig.parts_on_bones(['upperarm_L']) if o not in shown]
    for o in upper:
        o.is_holdout = True
        o.visible_glossy = False
        o.visible_transmission = False
    hidden = []
    objs = [o for o in rig.collection.all_objects if o.type in ('MESH', 'CURVE')]
    objs += [o for o in rig.cup_objects() if o.type in ('MESH', 'CURVE') and o not in objs]
    for o in objs:
        if o in shown or o in upper:
            continue
        o.visible_camera = False
        o.visible_glossy = False
        o.visible_transmission = False
        hidden.append(o)
    return sorted(shown, key=lambda o: o.name), hidden


# ---------------------------------------------------------------- camera

def heading_pitch(d):
    return math.atan2(-d.x, d.y), math.atan2(d.z, Vector((d.x, d.y)).length)


def cam_basis(h, p):
    fw = Vector((-math.sin(h) * math.cos(p), math.cos(h) * math.cos(p), math.sin(p)))
    rt = Vector((math.cos(h), math.sin(h), 0.0))
    up = rt.cross(fw)
    return fw, rt, up


def cam_rot(heading, pitch):
    """Camera rotation looking along heading (0 = +Y, + toward -X) and pitch, horizon level."""
    return Euler((math.pi / 2 + pitch, 0.0, heading), 'XYZ')


class CameraMove:
    """Lens 3 cm above the walnut, 40 mm f/2.8, keyed every frame (linear, so motion blur sees the
    true moves). On the cut: the approved s04_start framing. One arc round the padlock (bearing
    from the travel line, measured toward +X) eases in from f357, rides with the glide at the
    padlock's speed, and eases out 150 deg round, behind and beside it, by f414; the heading
    follows the padlock to a screen position (FRAME_X/Y) all the way, so it only ever pans one
    way. From f416 the dolly's speed falls away from the padlock's (it pulls ahead, the
    overtake) and comes to rest on f424; from f414 heading and pitch ease to the final frame."""

    def __init__(self, room, glide, home, stop, sc):
        self.glide, self.home, self.stop = glide, home, stop
        self.tz = R.TABLE_TOP
        self.u = (stop - home).normalized()
        self.n = Vector((self.u.y, -self.u.x))           # right of the travel line (+X side)
        _, ref = R.preview_camera(room, 's04_start')
        bpy.context.view_layer.update()
        self.ref_loc = ref.matrix_world.translation.copy()
        off0 = (self.ref_loc - self.pad(START)).to_2d()
        self.b0 = math.degrees(math.atan2(off0.dot(self.n), off0.dot(self.u)))
        self.r0 = off0.length
        for o in (ref, bpy.data.objects.get('focus_s04_start')):
            if o is not None:
                bpy.data.objects.remove(o)
        res_x = sc.render.resolution_x
        res_y = sc.render.resolution_y
        self.sw = 36.0
        self.sh = 36.0 * res_y / res_x
        self._sc = {}
        self._end = None

    def pad(self, f):
        p = self.home + self.u * self.glide.s(min(f, GLIDE[1]))
        return Vector((p.x, p.y, self.tz + 0.045))           # the padlock body's centre

    def s_cam(self, f):
        """Distance along the travel line: the padlock's until BRAKE[0], then its speed times
        (1 - smootherstep) to rest on BRAKE[1] (integrated)."""
        f0, f1 = BRAKE
        if f <= f0:
            return self.glide.s(f)
        key = round(min(f, f1), 4)
        if key in self._sc:
            return self._sc[key]
        s, x, dx = self.glide.s(f0), float(f0), 0.02
        while x < key - 1e-9:
            xm = x + dx / 2
            s += self.glide.v(xm) * (1.0 - smoother((xm - f0) / (f1 - f0))) * dx
            x += dx
        self._sc[key] = s
        return s

    def orbit(self, f):
        return trap(f, ORBIT[0], ORBIT[1], EASE_IN, EASE_OUT)

    def position(self, f):
        o = self.orbit(f)
        b = math.radians(self.b0 + (BETA_END - self.b0) * o)
        r = self.r0 + (R_END - self.r0) * o
        p = self.home + self.u * self.s_cam(f) + (self.n * math.sin(b) + self.u * math.cos(b)) * r
        return Vector((p.x, p.y, self.tz + CAM_Z))

    def project(self, h, p, c, q):
        fw, rt, up = cam_basis(h, p)
        d = q - c
        z = d.dot(fw)
        if z <= 1e-6:
            return Vector((9.9, 9.9, z))
        return Vector((0.5 + d.dot(rt) / z * LENS / self.sw, 0.5 + d.dot(up) / z * LENS / self.sh, z))

    def solve(self, c, q, xs, ys):
        """(heading, pitch) that puts world point q at image (xs, ys) from c."""
        h, p = heading_pitch(q - c)
        for _ in range(10):
            s = self.project(h, p, c, q)
            h -= math.atan((s.x - xs) * self.sw / LENS)
            p += math.atan((s.y - ys) * self.sh / LENS)
        return h, p

    def aim_ride(self, f):
        c = self.position(f)
        return self.solve(c, self.pad(f), curve(FRAME_X, f), curve(FRAME_Y, f))

    def aim(self, f):
        """Following the padlock to its screen position until ORBIT[1], then one cubic each for
        heading and pitch from there (position and speed) to rest on the final frame on END of
        the brake."""
        f0, f1 = ORBIT[1], BRAKE[1]
        if f <= f0:
            return self.aim_ride(f)
        if self._end is None:
            h0, p0 = self.aim_ride(f0)
            ha, pa = self.aim_ride(f0 - 0.5)
            hb, pb = self.aim_ride(f0 + 0.5)
            he, pe = self.solve(self.position(f1), self.pad(f1), FRAME_X[-1][1], FRAME_Y[-1][1])
            while he - h0 > math.pi:
                he -= 2 * math.pi
            while he - h0 < -math.pi:
                he += 2 * math.pi
            self._end = (h0, p0, hb - ha, pb - pa, he, pe)
        h0, p0, dh, dp, he, pe = self._end
        T = f1 - f0
        t = min(1.0, (f - f0) / T)
        a, b, c_, d = 2 * t ** 3 - 3 * t ** 2 + 1, t ** 3 - 2 * t ** 2 + t, -2 * t ** 3 + 3 * t ** 2, None
        return h0 * a + dh * T * b + he * c_, p0 * a + dp * T * b + pe * c_

    def bearing(self, f, pad_xy):
        dv = self.position(f).to_2d() - pad_xy
        return math.degrees(math.atan2(dv.dot(self.n), dv.dot(self.u)))

    def key(self, cam, foc, tip_at):
        prev = None
        self.headings = []
        for f in range(START, END + 1):
            loc = self.position(f)
            h, p = self.aim(f)
            if prev is not None:
                while h - prev > math.pi:
                    h -= 2 * math.pi
                while h - prev < -math.pi:
                    h += 2 * math.pi
            prev = h
            self.headings.append((f, h, p))
            cam.location = loc
            cam.rotation_euler = cam_rot(h, p)
            cam.keyframe_insert('location', frame=f)
            cam.keyframe_insert('rotation_euler', frame=f)
            # focus rides on the padlock, then racks to the fingertip (just above its contact)
            a = C.ease((f - RACK[0]) / (RACK[1] - RACK[0]))
            foc.location = self.pad(f).lerp(tip_at, a)
            foc.keyframe_insert('location', frame=f)
        for o in (cam, foc):
            for fc in C.fcurves(o.animation_data.action):
                for kp in fc.keyframe_points:
                    kp.interpolation = 'LINEAR'
        # the pan only ever goes one way (the critique's check): no sign flip in dh
        dhs = [(b[0], b[1] - a[1]) for a, b in zip(self.headings, self.headings[1:])]
        sign = [s for s in (math.copysign(1, d) for _, d in dhs if abs(d) > 1e-5)]
        flips = [dhs[i + 1][0] for i in range(len(dhs) - 1)
                 if abs(dhs[i][1]) > 1e-5 and abs(dhs[i + 1][1]) > 1e-5 and dhs[i][1] * dhs[i + 1][1] < 0]
        self.flips = flips
        self.peak = max(abs(math.degrees(d)) for _, d in dhs)
        if flips:
            print(f'S04 WARNING: the pan reverses on {flips}', flush=True)
        return sign


def camera_move(room, glide, home, stop, tip_at):
    sc = bpy.context.scene
    mv = CameraMove(room, glide, home, stop, sc)
    cam = C.camera('cam_s04', LENS, tuple(mv.ref_loc), None, fstop=FSTOP, clip=(0.005, 200.0))
    foc = C.empty('focus_s04', None, tuple(mv.pad(START)))
    cam.data.dof.focus_object = foc
    mv.key(cam, foc, tip_at)
    sc.camera = cam
    # a shorter shutter through the fast part of the arc (less smear on the background)
    r = sc.render
    for f, v in ((SHUTTER_SPAN[0] - 4, 0.5), (SHUTTER_SPAN[0], SHUTTER_RIDE), (SHUTTER_SPAN[1], SHUTTER_RIDE),
                 (SHUTTER_SPAN[1] + 6, 0.5)):
        r.motion_blur_shutter = v
        sc.keyframe_insert('render.motion_blur_shutter', frame=f)
    return cam, mv


# ---------------------------------------------------------------- the padlock

def key_padlock(pad, glide, home, u, yaw0, mv):
    """Location every frame on the glide (linear keys), and its half turn: the turn follows the
    camera's arc (so its broad face stays within ~47 deg of the lens), eased in from rest on
    GLIDE[0], and is complete before the brake's last frames so it arrives square (S09)."""
    z = pad.location.z
    f0 = GLIDE[0]
    f_done = ORBIT[1] + 2
    b_start = mv.bearing(f0, mv.pad(f0).to_2d())
    b_end = mv.bearing(f_done, mv.pad(f_done).to_2d())
    turns = {}
    for f in range(f0 - 1, GLIDE[1] + 1):
        b = mv.bearing(f, mv.pad(f).to_2d())
        # the turn runs a few degrees ahead of the arc (it starts from rest on f0, eased in over
        # 4 frames, while the lens is already ~44 deg round)
        k = min(1.0, max(0.0, (b - b_start + 6.0) / (b_end - b_start + 6.0))) * smoothstep((f - f0) / 4.0)
        if f >= f_done:
            k = 1.0
        turns[f] = k
    for f in range(f0 - 1, GLIDE[1] + 1):
        p = home + u * glide.s(f)
        pad.location = (p.x, p.y, z)
        pad.rotation_euler.z = yaw0 - math.radians(TURN) * turns[f]
        pad.keyframe_insert('location', frame=f)
        pad.keyframe_insert('rotation_euler', index=2, frame=f)
    pad.keyframe_insert('location', frame=END)
    pad.keyframe_insert('rotation_euler', index=2, frame=END)
    for fc in C.fcurves(pad.animation_data.action):
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'
    return turns


# ---------------------------------------------------------------- light

def walnut_bounce(shown):
    """The slab's warm bounce off the walnut (rig owner's note): lifts the back of his hand and
    his forearm from below. Invisible to camera and glossy rays, linked to them only."""
    sp = Vector(R.SYNERGY_POS)
    lt = C.area_light('s04_walnut_bounce', (sp.x + 0.12, sp.y - 0.85, R.TABLE_TOP + 0.02),
                      (0.33, 0.0, 0.92), BOUNCE_E, 0.9, 0.45, color=(1.0, 0.84, 0.70),
                      coll=C.collection('S04_light'))
    lt.visible_camera = False
    lt.visible_glossy = False
    recv = bpy.data.collections.new('S04_bounce_receivers')
    for o in shown:
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


def mirror_spot(pad, cam, dist, up, spin=0.0):
    """Where a card must sit for the padlock's broad face (the one toward the lens) to mirror it
    to the camera (spin turns the spot about the padlock, degrees, for a second card)."""
    p = pad.matrix_world.translation.copy()
    c = cam.matrix_world.translation - p
    c = Vector((c.x, c.y, 0.0)).normalized()
    nrm = pad.matrix_world.to_3x3() @ Vector((0.0, 1.0, 0.0))
    nrm = Vector((nrm.x, nrm.y, 0.0)).normalized()
    if nrm.dot(c) < 0:
        nrm = -nrm
    mirror = (nrm * (2.0 * nrm.dot(c)) - c).normalized()
    if spin:
        a = math.radians(spin)
        mirror = Vector((mirror.x * math.cos(a) - mirror.y * math.sin(a), mirror.x * math.sin(a) + mirror.y * math.cos(a), 0))
    pos = p + mirror * dist + Vector((0.0, 0.0, up))
    aim = (p + Vector((0.0, 0.0, 0.03))) - pos
    return pos, aim.to_track_quat('-Z', 'Y').to_matrix()


def padlock_cards(room, pad, cam, flash_frame):
    """The padlock kit's warm card (light-linked to the padlock), re-aimed every frame to where
    the broad face we see mirrors it, flaring once as the padlock crosses into the skylight slab
    (the treatment's flash); a sky-blue rim while Kevin speaks; a cobalt and an ivory card as it
    passes Keys and Synthia (the brass streaks with every colour it passes)."""
    card = room.insert_lights('padlock', target=pad)['card']
    card.parent = None
    fc = int(round(flash_frame))
    for f, k in ((fc - 2, 1.0), (fc, FLASH), (fc + 1, FLASH * 0.6), (fc + 4, 1.0)):
        card.data.energy = CARD_E * k
        card.data.keyframe_insert('energy', frame=f)
    coll = C.collection('S04_light')
    recv = bpy.data.collections.get('LR_ins_padlock_receivers')
    extra = []
    # Kevin's rim: a small sky-blue card behind the padlock and to its right as the lens sees it
    # (toward his screen), so the brass's right edge carries his colour while he speaks
    rim = C.area_light('s04_kevin_rim', (0, 0, 1), None, 0.0, 0.10, 0.22, color=(0.72, 0.85, 1.0), coll=coll)
    for f, e in ((START, RIM_E), (SYLLABLES[-1][0] + 8, RIM_E), (GLIDE[0] + 6, 0.0)):
        rim.data.energy = e
        rim.data.keyframe_insert('energy', frame=f)
    for nm, f_pass, gain in PASS:
        t = room.terminals[nm]
        rgb = list(t.rgb)
        mx = max(rgb)
        lt = C.area_light(f's04_pass_{nm}', (0, 0, 1), None, 0.0, 0.30, 0.14, color=tuple(x / mx for x in rgb), coll=coll)
        for f, e in ((f_pass - 5, 0.0), (f_pass, gain), (f_pass + 4, 0.0)):
            lt.data.energy = e
            lt.data.keyframe_insert('energy', frame=f)
        extra.append((lt, 0.50, 0.12, 18.0))
    for lt in [rim] + [e[0] for e in extra]:
        lt.visible_camera = False
        lt.visible_diffuse = False
        lt.visible_transmission = False
        lt.data.spread = math.radians(90)
        if recv is not None:
            lt.light_linking.receiver_collection = recv
    for o in [card, rim] + [e[0] for e in extra]:
        for fcv in C.fcurves(o.data.animation_data.action):
            for kp in fcv.keyframe_points:
                kp.interpolation = 'LINEAR'
    sc = bpy.context.scene
    for f in range(START, END + 1):
        sc.frame_set(f)
        pos, rot = mirror_spot(pad, cam, CARD_DIST, CARD_UP)
        card.location = pos
        card.rotation_euler = rot.to_euler('XYZ', card.rotation_euler)
        card.keyframe_insert('location', frame=f)
        card.keyframe_insert('rotation_euler', frame=f)
        if f <= GLIDE[0] + 6:
            p = pad.matrix_world.translation + Vector((0.0, 0.0, 0.04))
            cm = cam.matrix_world
            away = (p - cm.translation)
            away = Vector((away.x, away.y, 0.0)).normalized()
            right = (cm.to_3x3() @ Vector((1.0, 0.0, 0.0)))
            right = Vector((right.x, right.y, 0.0)).normalized()
            rim.location = p + away * 0.16 + right * 0.13 + Vector((0.0, 0.0, 0.03))
            rim.rotation_euler = (p - rim.location).to_track_quat('-Z', 'Y').to_euler('XYZ', rim.rotation_euler)
            rim.keyframe_insert('location', frame=f)
            rim.keyframe_insert('rotation_euler', frame=f)
        for lt, dist, up, spin in extra:
            pos, rot = mirror_spot(pad, cam, dist, up, spin)
            lt.location = pos
            lt.rotation_euler = rot.to_euler('XYZ', lt.rotation_euler)
            lt.keyframe_insert('location', frame=f)
            lt.keyframe_insert('rotation_euler', frame=f)
    return card


def walnut_mirror_cards(room):
    """For this lens (3 cm over the walnut, looking up the table at the end): what the walnut
    mirrors near the head is the dark head wall, so the coat reads brown-black. Glossy-only
    cards that only the walnut sees (as the room's streak cards): thin upright strips in the
    near colleagues' colours standing over the head end, each mirrored as a long streak toward
    the lens, and one cool 6500K strip across the head end low down (the slab's spill on the
    head wall), mirrored as a hard band under the horizon."""
    coll = C.collection('S04_light')
    walnut = R.walnut_objects(room)
    recv = bpy.data.collections.get('S04_walnut_receivers') or bpy.data.collections.new('S04_walnut_receivers')
    for o in walnut:
        if recv.objects.get(o.name) is None:
            recv.objects.link(o)
    cards = []
    strips = (('synthia', -0.62, 1.05), ('keys', -0.28, 0.95), ('kevin', 0.02, 1.10), ('arjun', 0.62, 0.98),
              ('strategy', 0.90, 1.08))
    for nm, x, zc in strips:
        t = room.terminals[nm]
        rgb = list(t.rgb)
        mx = max(rgb)
        lt = C.area_light(f's04_mirror_{nm}', (x, 1.30, zc), (x, 0.0, zc), STREAK_E, 0.05, 0.42,
                          color=tuple(v / mx for v in rgb), coll=coll)
        cards.append(lt)
    band = C.area_light('s04_mirror_band', (0.15, 1.35, 0.86), (0.15, 0.0, 0.86), BAND_E, 2.2, 0.035,
                        color=(0.90, 0.94, 1.0), coll=coll)
    cards.append(band)
    for lt in cards:
        lt.visible_camera = False
        lt.visible_diffuse = False
        lt.visible_transmission = False
        lt.visible_glossy = True
        lt.data.spread = math.radians(120)
        lt.light_linking.receiver_collection = recv
    return cards


def walnut_grade(room):
    """This lens sits 3 cm over the walnut, so the slab-lit coat by the lens fills the lower
    frame, and its purple-grey heartwood reads as a dusty mauve wash against S03's warm beige
    slab at the cut. Hold it to S03's beige for this shot: the walnut's base colour times
    WALNUT_TINT (the materials are this scene's own copies; the library is untouched)."""
    done = set()
    for o in R.walnut_objects(room):
        for slot in o.material_slots:
            m = slot.material
            if m is None or m.name in done or not m.use_nodes:
                continue
            done.add(m.name)
            nt = m.node_tree
            bsdf = next((n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED'), None)
            if bsdf is None or not bsdf.inputs['Base Color'].is_linked:
                continue
            src = bsdf.inputs['Base Color'].links[0].from_socket
            mul = nt.nodes.new('ShaderNodeMix')
            mul.data_type = 'RGBA'
            mul.blend_type = 'MULTIPLY'
            mul.inputs[0].default_value = 1.0
            ca = next(i for i in mul.inputs if i.name == 'A' and i.type == 'RGBA')
            cb = next(i for i in mul.inputs if i.name == 'B' and i.type == 'RGBA')
            nt.links.new(src, ca)
            cb.default_value = (*WALNUT_TINT, 1.0)
            out = next(o for o in mul.outputs if o.type == 'RGBA')
            nt.links.new(out, bsdf.inputs['Base Color'])
    return sorted(done)


# ---------------------------------------------------------------- report

def report(rig, cam, mv, pad, stop, shown, hidden, turns, tip_world):
    """Measured sync points and gates: where the padlock and the fingertip sit in frame, the first
    frame any of his hand shows, the pan, the padlock's face angle to the lens, the fingertip's
    visibility in the hold and that nothing but the forearm and hand of him is visible."""
    from bpy_extras.object_utils import world_to_camera_view
    sc = bpy.context.scene
    hand = rig.parts_on_bones(HAND_L)
    idx3 = rig.parts_on_bones(['index_3_L'])
    first = None
    for f in range(LIFT[0], END + 1):
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
    gates = []
    gates.append(('hand first in frame <= f410', first is not None and first <= FINGER[0]))
    for f in (START, 369, 376, GLIDE[0], 388, 395, 400, 404, DECEL, FINGER[0], 414, FINGER[1], 420, GLIDE[1], END):
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        q = world_to_camera_view(sc, cam, pad.matrix_world.translation + Vector((0, 0, 0.045)))
        ev = idx3[0].evaluated_get(dg)
        tv = min((ev.matrix_world @ v.co for v in ev.data.vertices), key=lambda v: v.y)
        t = world_to_camera_view(sc, cam, tv)
        kv = world_to_camera_view(sc, cam, mv.kevin_screen)
        dv = (cam.matrix_world.translation - pad.matrix_world.translation).to_2d()
        nrm = (pad.matrix_world.to_3x3() @ Vector((0, 1, 0))).to_2d().normalized()
        face = math.degrees(math.acos(min(1.0, abs(nrm.dot(dv.normalized())))))
        print(f'S04 f{f} padlock at image ({q.x:.3f}, {q.y:.3f}) d={q.z:.3f} face {face:.0f} deg; '
              f'fingertip ({t.x:.3f}, {t.y:.3f}); kevin screen ({kv.x:.2f}, {kv.y:.2f})', flush=True)
        if f == FINGER[0]:
            gates.append(('tip on f410 inside x 0.55-0.95, y 0.55-0.95', 0.55 <= t.x <= 0.95 and 0.55 <= t.y <= 0.95))
            gates.append(('padlock on f410 in the left half, lower half', q.x < 0.5 and q.y < 0.5))
        if f == 376:
            gates.append(("Kevin's screen in frame on f376", 0.05 <= kv.x <= 0.95))
    # pan and tilt
    rows = mv.headings
    dh = [math.degrees(b[1] - a[1]) for a, b in zip(rows, rows[1:])]
    dp = [math.degrees(b[2] - a[2]) for a, b in zip(rows, rows[1:])]
    print(f'S04 pan peak {max(abs(x) for x in dh):.2f} deg/frame, tilt peak {max(abs(x) for x in dp):.2f}; '
          f'pan reverses on {mv.flips or "no frame"}', flush=True)
    print('S04 pan per frame ' + ' '.join(f'{rows[i + 1][0]}:{x:+.2f}' for i, x in enumerate(dh)), flush=True)
    gates.append(('pan never reverses', not mv.flips))
    # face angle through the ride
    worst = 0.0
    for f in range(GLIDE[0], GLIDE[1] + 1):
        sc.frame_set(f)
        dv = (cam.matrix_world.translation - pad.matrix_world.translation).to_2d()
        nrm = (pad.matrix_world.to_3x3() @ Vector((0, 1, 0))).to_2d().normalized()
        worst = max(worst, math.degrees(math.acos(min(1.0, abs(nrm.dot(dv.normalized()))))))
    print(f'S04 the broad face is at most {worst:.1f} deg from the lens over f{GLIDE[0]}-{GLIDE[1]}', flush=True)
    gates.append(('broad face <= 48 deg to the lens on the ride', worst <= 48.0))
    # the bronze tip in the hold: rays from the lens to index_3_L
    vis_n = tot = 0
    for f in (424, 428, 432):
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        cpos = cam.matrix_world.translation.copy()
        ev = idx3[0].evaluated_get(dg)
        for v in ev.data.vertices:
            w = ev.matrix_world @ v.co
            d = w - cpos
            hit, loc, nrm, i, ob, _ = sc.ray_cast(dg, cpos, d.normalized(), distance=d.length + 0.002)
            tot += 1
            if hit and ob is not None and ob.name == idx3[0].name:
                vis_n += 1
    frac = vis_n / max(1, tot)
    print(f'S04 the index tip segment is {100 * frac:.0f}% unoccluded from the lens on f424-432', flush=True)
    gates.append(('bronze tip visible in the hold (>= 25% of index_3)', frac >= 0.25))
    # what of him is visible (camera rays; hidden parts are skipped by the renderer)
    hid = set(o.name for o in hidden)
    seen = {}
    for f in range(392, END + 1, 4):
        sc.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        cpos = cam.matrix_world.translation.copy()
        for o in shown:
            ev = o.evaluated_get(dg)
            n = 0
            for v in list(ev.data.vertices)[::5]:
                w = ev.matrix_world @ v.co
                c = world_to_camera_view(sc, cam, w)
                if not (0 <= c.x <= 1 and 0 <= c.y <= 1 and c.z > 0):
                    continue
                d = w - cpos
                o2, dd = cpos, d.normalized()
                ok = False
                for _ in range(8):
                    hit, loc, nrm, i, ob, _ = sc.ray_cast(dg, o2, dd, distance=(w - o2).length + 0.002)
                    if not hit:
                        break
                    if ob is not None and ob.name in hid:
                        o2 = loc + dd * 0.0005
                        continue
                    ok = ob is not None and (ob.name == o.name or (loc - w).length < 0.003)
                    break
                n += ok
            if n:
                seen[o.name.replace('Synergy_', '')] = seen.get(o.name.replace('Synergy_', ''), 0) + n
    print(f'S04 visible parts of him f392-432 (ray-tested samples): {sorted(seen.items(), key=lambda kv: -kv[1])}',
          flush=True)
    print(f'S04 hidden from camera and glossy rays: {len(hidden)} parts of him', flush=True)
    shut = []
    for f in (378, 384, 392, 404, 412):
        sc.frame_set(f)
        shut.append(f'f{f}:{sc.render.motion_blur_shutter:.2f}')
    print(f'S04 shown parts: {[o.name for o in shown]}; shutter {" ".join(shut)}', flush=True)
    for name, ok in gates:
        print(f'S04 GATE {"PASS" if ok else "FAIL"}: {name}', flush=True)


# ---------------------------------------------------------------- build

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
    yaw0 = pad.rotation_euler.z
    # S09's contact: the slide line runs SLIDE_OFFSET to his right of the tip; the stop is
    # measured against the real hand (posed at the knock) with the padlock at its end yaw
    sc.frame_set(END)
    contract = Vector(R.stop_for('padlock', obj=pad, start=tuple(home)))
    dirn = (contract - home).normalized()
    side = Vector((-dirn.y, dirn.x))
    if side.x > 0:
        side = -side
    tip2 = Vector(R.ROOM['fingertip_L'][:2]) + side * SLIDE_OFFSET
    pad.rotation_euler.z = yaw0 - math.radians(TURN)
    bpy.context.view_layer.update()
    stop = Vector(R.stop_for('padlock', obj=pad, start=tuple(home), tip=tuple(tip2), hand=rig.parts_on_bones(HAND_L)))
    pad.rotation_euler.z = yaw0
    bpy.context.view_layer.update()
    glide = Glide((stop - home).length)
    u = (stop - home).normalized()
    print(f'S04 glide {glide.L:.3f} m, cruise {glide.vmax * C.FPS:.2f} m/s, knock {V_KNOCK * C.FPS:.2f} m/s; '
          f'stop {tuple(round(x, 4) for x in stop)} (centred contract {tuple(round(x, 4) for x in contract)}, '
          f'line {SLIDE_OFFSET * 1000:.0f} mm to his right)', flush=True)
    # the focus target: the index tip's end, just above the walnut
    idx3 = rig.parts_on_bones(['index_3_L'])[0]
    dg = bpy.context.evaluated_depsgraph_get()
    ev = idx3.evaluated_get(dg)
    vs = [ev.matrix_world @ v.co for v in ev.data.vertices]
    tip_world = min(vs, key=lambda v: v.y) + Vector((0.0, 0.004, 0.004))
    low = min(v.z for v in vs) - R.TABLE_TOP
    print(f'S04 index tip underside {low * 1000:.2f} mm over the walnut at rest', flush=True)
    cam, mv = camera_move(room, glide, home, stop, tip_world)
    mv.kevin_screen = room.terminals['kevin'].to_world((0.0, 0.19, 0.293))
    turns = key_padlock(pad, glide, home, u, yaw0, mv)
    room.use_kits('padlock')
    flash = slab_entry(glide, home, stop)
    print(f'S04 the padlock crosses the slab edge at f{flash:.1f}', flush=True)
    padlock_cards(room, pad, cam, flash)
    shown, hidden = hide_rest_of_him(rig)
    walnut_bounce(shown)
    walnut_mirror_cards(room)
    print(f'S04 walnut graded: {walnut_grade(room)}', flush=True)
    room.hub.leds.visible_camera = False          # its mic LEDs: a green smear on the brass face
    room.hub.leds.visible_glossy = False
    # the hub's cropped lobe at frame left in the hold reads as a grey dome (a computer mouse):
    # the slab's sheen on it is what greys it, so the sun skips it here (it stays black plastic)
    ex = bpy.data.collections.new('S04_sun_excludes')
    for o in R._meshes(room.hub.root):
        ex.objects.link(o)
    for co in ex.collection_objects:
        co.light_linking.link_state = 'EXCLUDE'
    if room.sun.light_linking.receiver_collection is None:
        room.sun.light_linking.receiver_collection = ex
    else:
        print('S04 WARNING: the room sun already has a receiver collection; hub left lit', flush=True)
    sc.frame_set(LOCKED)
    room.front_bokeh(cam, LOCKED)                 # colour discs in the dark beyond him (head wall off for camera)
    room.render_budget(kind='macro', samples=args.samples or None)
    room.compositor(threshold=1.6)
    room.tune_scanlines(cam)
    sc.view_settings.exposure = 0.0
    report(rig, cam, mv, pad, stop, shown, hidden, turns, tip_world)
    return room, rig, cam


def render(args):
    """common.render, in two passes: the animated sampling seed while anything moves, a fixed
    seed from LOCKED (the locked hold must not boil)."""
    sc = bpy.context.scene
    frames = C.frame_list(args, START, END)
    moving = [f for f in frames if f < LOCKED]
    still = [f for f in frames if f >= LOCKED]
    done = []
    for group, animated in ((moving, True), (still, False)):
        if not group:
            continue
        sc.cycles.use_animated_seed = animated
        args.only = ','.join(str(f) for f in group)
        done += C.render(SHOT, args, START, END)
    return done


if __name__ == '__main__':
    a = C.shot_args()
    build(a)
    render(a)
