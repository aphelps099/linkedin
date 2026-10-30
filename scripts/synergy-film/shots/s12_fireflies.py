"""S12 · f1153-1248 · 48.00-52.00 s · E1_OFFLINE (night): the fireflies fall into step.

    blender -b --factory-startup -P shots/s12_fireflies.py -- --quality proof --only 1153,1185,1189,1201,1203,1217,1233,1248
    blender -b --factory-startup -P shots/s12_fireflies.py -- --quality animatic --step 8
    blender -b --factory-startup -P shots/s12_fireflies.py -- --quality final

Night inside the cup, the music back clean and close. The colour blooms have left the paper (Pat's faint
grey one is the only glow left in the cliffs, at the left edge), the slot's shaft is moon-silver and
stands at the right over the island and the box, the sea and the paddies are black mirrors, and the
padlock arch stands dark left of centre, its crest's pines and padlocks haloed by fireflies (the roosting
origami birds sit on the crest's top face, mostly out of sight from this low lens). About 1,500
fireflies in the colleagues' colours rise from the terraces, the drift over the water and the crest
pines; all colour lives in them.

Beats (film frames; 90 BPM = 16 frames a beat; every flash is a 2-frame rise into the beat frame and a
10-frame decay, from env_offline's in-shader Kuramoto clock):
  f1153 (beat 72) the cut: the swarm still on the grass and the water, lifting off (each firefly rises
              over 34 frames, starting f1148-1186), blinking at random. The top edge cuts the arch's crest;
              the paddy's mirror under the lens fills the lower third with the arch's legs
  f1153-1184  random blinking while the coupling ramps (env clock: f1150-1192); the tilt brings the
              crest's pines into frame by ~f1175
  f1185 (74)  they flash together, doubled in the paddy and in the sea; Pat's grey firefly, alone
              in the arch's opening, peaks 4 frames late (f1189)
  f1201 (75)  together again; the grey one 2 late (f1203)
  f1217 (76)  bar 19 downbeat: all of them, grey included, flash in perfect unison
  f1233 (77)  unison again
  f1248       the lens comes to rest; cut to the dark room on f1249

Camera: env framing 's12_fireflies' (30 mm, the accepted lens change, f/2.8 focused at 16 m) from
E.CAM_S12, 1.5 m above the second paddy's mirror on the terraces' south-west flank, panned 2.5 degrees
left of its azimuth (the crest 7.5 degrees left of the axis, not 10), so the terrace riser beside the
lens is a thin grassy edge at frame right instead of a green wedge. One eased crane move over the whole
shot: a 3 m rise and a tilt from +5 to +10 degrees (a cubic already drifting up at the cut, 0.6 x its
mean speed, at rest on f1248). The lens-side fireflies (1-3 m) bloom into soft discs and drift through the foreground.

Deviation from the treatment's camera numbers (direction and intent held): the tilt ends at +10, not
+18. In this cup the paddy in front of the lens is ~30 m deep and the swarm hovers 2-15 m over the land
and water. At +18 a 30 mm frame's lower edge is 0.7 degrees under the horizon, so by the f1217 lock
both mirrors had left the frame and the unison played over empty dark cliff (tested at proof). +10
keeps the doubling in frame at every sync point and still reveals the crest against the dark paper.

Light: the env night state and the framing's levels (moon top disc x0.4, box skylight 2.0), plus, for
this shot: the arch's albedo at 0.5 (a dark shape under the crest's halo of fireflies), the swarm's
light on the world at half the env gain and kept off the island's pale stone (it lit it as pastel
mottle on every beat), the glint strip light-linked off the paddies (its mirror image was a hard white
bar low in frame), and no motion blur on the never-denoised firefly points (14 samples along a rising
firefly's streak read as a dotted glyph). The fireflies' own light stays out of the denoiser
(env apply_look). The falls are not built: they stand ~60 degrees right of the lens axis, outside the
frame and every mirror.
Sampling: a new seed per frame while the lens moves (more than 0.3 px/frame at 20 m), the fixed seed
once it rests (f1248).
"""

import json
import math
import os
import sys

import bpy
from mathutils import Euler, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'lib'))

import common as C  # noqa: E402
import env_offline as E  # noqa: E402

SHOT = 's12'
INFO = next(s for s in json.load(open(os.path.join(HERE, 'shots.json'))) if s['id'] == SHOT)
START, END = INFO['start'], INFO['end']

# ------------------------------------------------------------------ sync points (film frames, 16 per beat)
BEGIN = 1185            # beat 74: the swarm begins to flash together (the grey one peaks 4 late, f1189)
SECOND = 1201           # beat 75: together again (grey 2 late, f1203)
LOCK = 1217             # beat 76, bar 19 downbeat: all of them, grey included, in perfect unison
AGAIN = 1233            # beat 77: unison again
GREY_PEAKS = (1189, 1203)   # the grey (Pat's) firefly's late peaks (env_offline's firefly clock)

# ------------------------------------------------------------------ camera (starts on env framing 's12_fireflies')
LENS = 30.0             # accepted lens change (treatment 35 mm)
FSTOP = 2.8
FOCUS = 16.0            # m (the env framing): the mid-ground swarm sharp, the lens-side few bloom into discs
RISE = 3.0              # m, from 1.5 m above the second paddy's mirror (E.CAM_S12)
PITCH0, PITCH1 = 5.0, 10.0   # deg: the tilt up
YAW_OFF = -7.5          # deg from the crest's azimuth (env framing -10): the crest left of centre, the shaft
                        # right; the riser beside the lens is a thin grassy edge at frame right, not a green wedge
MOVE = (START, END)     # the rise and tilt run the whole shot
SLOPE0, SLOPE1 = 0.6, 0.0    # Hermite end slopes (x the mean speed): already drifting up at the cut, at rest at the end
SEED_PX = 0.3           # animated sampling seed while a point 20 m out moves more than this (px/frame at 1600 px)

# ------------------------------------------------------------------ world
EXCLUDE = {'falls'}     # the paper falls stand ~60 degrees right of the lens axis: out of frame and out of every mirror
GREY_AT = (-76.2, 20.6, 38.9)   # Pat's grey firefly: the swarm's one that hangs alone in the arch's opening
FILLS = {'padlock': 0.5, 'arch_stone': 0.5}   # arch albedo (env apply_fills): a dark shape, all colour in the fireflies
FIREFLY_LIGHT = 0.5     # x env FIREFLY_LIGHT_GAIN: each flash lights the grass and water round it; at full gain the
                        # swarm along the island's south shore turned its pale stone into pastel mottle on every beat
CRISP_FIREFLIES = True  # no motion blur on the far points: they are never denoised, so 14 samples along a rising
                        # firefly's streak read as a dotted glyph (the lens-side bokeh discs are denoised: they keep it)
DARK_ISLAND = True      # the island's pale stone takes no firefly light (light linking): the swarm along its south
                        # shore lit it as pastel mottle; it stays moon-silver in the shaft's pool, as in S14
GLINT_OFF_PADDIES = True     # the glint strip (a stand-in that puts silver glitter on the sea) would stand in the
                             # paddies' mirror as a hard white bar: light-link it off them


def hermite(t, s0=None, s1=None):
    """Cubic from 0 to 1 on t in 0..1 with end slopes s0, s1 (x the mean speed)."""
    s0 = SLOPE0 if s0 is None else s0
    s1 = SLOPE1 if s1 is None else s1
    t = min(1.0, max(0.0, t))
    t2, t3 = t * t, t * t * t
    return (t3 - 2 * t2 + t) * s0 + (-2 * t3 + 3 * t2) + (t3 - t2) * s1


class Move:
    """The lens: rises RISE m and tilts PITCH0 -> PITCH1 on a fixed azimuth."""

    def __init__(self):
        fr = E.framing('s12_fireflies')
        self.fr = fr
        self.p0 = Vector(fr['location'])
        crest = E.arch_crest()
        d = (crest - self.p0).to_2d().normalized()
        self.yaw = math.atan2(d.y, d.x) + math.radians(YAW_OFF)

    def u(self, f):
        return hermite((f - MOVE[0]) / float(MOVE[1] - MOVE[0]))

    def state(self, f):
        u = self.u(f)
        loc = self.p0 + Vector((0.0, 0.0, RISE * u))
        pitch = math.radians(PITCH0 + (PITCH1 - PITCH0) * u)
        return loc, self.yaw, pitch

    def euler(self, f):
        _l, yaw, pitch = self.state(f)
        return Euler((math.pi / 2 + pitch, 0.0, yaw - math.pi / 2), 'XYZ')

    def forward(self, f):
        _l, yaw, pitch = self.state(f)
        return Vector((math.cos(yaw) * math.cos(pitch), math.sin(yaw) * math.cos(pitch), math.sin(pitch)))

    def motion_px(self, f, near=20.0, width=1600):
        """Screen motion (px/frame at `width`) of a point `near` m away between f-1 and f."""
        la, _ya, pa = self.state(f - 1)
        lb, _yb, pb = self.state(f)
        fov = 2 * math.atan(18.0 / LENS)
        return ((lb - la).length / near + abs(pb - pa)) * width / fov

    def view(self, f, res_x=1600):
        loc, _y, _p = self.state(f)
        return dict(location=tuple(loc), lens=LENS, res_x=res_x, target=tuple(loc + self.forward(f) * 100.0))


def unglint_paddies(h):
    """Keep the glossy-only glint strip off the paddies (it still glitters on the sea)."""
    L, pad = h['lights'].get('glint'), h['objects'].get('paddies')
    if L is None or pad is None:
        return
    rc = bpy.data.collections.new('S12_GlintExcluded')       # not in the scene: a link set
    rc.objects.link(pad)
    L.light_linking.receiver_collection = rc
    for co in rc.collection_objects:
        co.light_linking.link_state = 'EXCLUDE'


def tune_fireflies(h):
    """S12's levels for the swarm: its light on the world, and crisp (unblurred) points."""
    m = h['mats'].get('firefly_light')
    if m is not None and 'FireflyLightGain' in m.node_tree.nodes:
        n = m.node_tree.nodes['FireflyLightGain']
        n.outputs[0].default_value = E.FIREFLY_LIGHT_GAIN * FIREFLY_LIGHT
    if CRISP_FIREFLIES:
        for k in ('fireflies', 'fireflies_light'):
            o = h['objects'].get(k)
            if o is not None:
                o.cycles.use_motion_blur = False
    L, isl = h['objects'].get('fireflies_light'), h['objects'].get('island')
    if DARK_ISLAND and L is not None and isl is not None:
        rc = bpy.data.collections.new('S12_FireflyLightExcluded')     # not in the scene: a link set
        rc.objects.link(isl)
        L.light_linking.receiver_collection = rc
        for co in rc.collection_objects:
            co.light_linking.link_state = 'EXCLUDE'


def build_camera(move):
    loc0, _y, _p = move.state(START)
    cam = E.camera_offline(LENS, loc0, loc0 + move.forward(START), fstop=FSTOP, focus=FOCUS)
    cam.rotation_mode = 'XYZ'
    for f in range(START - 2, END + 3):
        loc, _y, _p = move.state(f)
        cam.location = loc
        cam.rotation_euler = move.euler(f)
        cam.keyframe_insert('location', frame=f)
        cam.keyframe_insert('rotation_euler', frame=f)
    for fc in C.fcurves(cam.animation_data.action):
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'
    return cam


def key_seed(sc, move):
    """A fresh sampling seed per frame while the lens moves (no noise pattern stuck to the screen as the
    world slides under it), the fixed seed where it is (near) still (nothing static boils)."""
    cy = sc.cycles
    cy.use_animated_seed = False
    for f in range(START - 2, END + 3):
        moving = START <= f <= END and max(move.motion_px(f), move.motion_px(min(f + 1, END))) > SEED_PX
        cy.seed = f if moving else 0
        cy.keyframe_insert('seed', frame=f)
    for fc in C.fcurves(sc.animation_data.action):
        if fc.data_path == 'cycles.seed':
            for kp in fc.keyframe_points:
                kp.interpolation = 'CONSTANT'


def project(cam, p):
    from bpy_extras.object_utils import world_to_camera_view
    v = world_to_camera_view(bpy.context.scene, cam, Vector(p))
    return v.x, v.y, v.z


def report(h, cam, move):
    """Print the lens, and where the crest, the box, the grey firefly and the horizon sit in frame."""
    sc = bpy.context.scene
    crest = E.arch_crest()
    grey = Vector(h.get('grey_firefly', (0, 0, 0)))
    for f in (START, 1161, 1169, 1177, BEGIN, GREY_PEAKS[0], SECOND, GREY_PEAKS[1], 1209, LOCK, 1225, AGAIN, 1241, END):
        sc.frame_set(f)
        loc, _yaw, pitch = move.state(f)
        cx, cy_, _ = project(cam, crest)
        bx, by, _ = project(cam, E.BOX_C)
        gx, gy, gz = project(cam, grey)
        hz = project(cam, loc + Vector((math.cos(move.yaw), math.sin(move.yaw), 0.0)) * 5000.0)[1]
        print(f'S12 f{f} cam z {loc.z:.2f} pitch {math.degrees(pitch):.2f} move {move.motion_px(f):.2f}px '
              f'seed {sc.cycles.seed} | crest {cx:.3f},{cy_:.3f} box {bx:.3f},{by:.3f} horizon y {hz:.3f} '
              f'| grey {gx:.3f},{gy:.3f} at {gz:.1f} m', flush=True)
    sc.frame_set(START)


def build(args):
    sc = C.new_scene(START, END, args.quality, samples=args.samples, threads=args.threads)
    move = Move()
    fr = move.fr
    kw = E.build_kwargs(fr)
    kw['view'] = move.view(LOCK)
    kw['grey_near'] = GREY_AT
    parts = set(fr['include']) - EXCLUDE
    h = E.build_offline(fr['state'], include=parts, frames=(START, END), **kw)
    E.tune_render(sc, args.quality, args.samples)
    E.apply_fills(h, FILLS)
    E.apply_values(h, fr.get('values'))
    E.apply_light_levels(h, fr.get('lights'))
    if GLINT_OFF_PADDIES:
        unglint_paddies(h)
    tune_fireflies(h)
    cam = build_camera(move)
    sc.camera = cam
    E.set_shaft_camera(h, fr.get('shaft_camera', True))
    E.apply_look(fr['state'], **fr.get('look', {}))
    key_seed(sc, move)
    report(h, cam, move)
    sc.frame_set(START)
    return dict(h=h, cam=cam, move=move)


if __name__ == '__main__':
    a = C.shot_args()
    build(a)
    C.render(SHOT, a, START, END)
