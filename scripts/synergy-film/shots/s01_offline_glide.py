"""S01 · f1-128 · 0.00-5.33 s · E1_OFFLINE (day): the glide and the eclipse.

    blender -b --factory-startup -P shots/s01_offline_glide.py -- --quality proof --only 1,9,14,20,40,60,80,81,90,96,104,108,112,116,120,124,128
    blender -b --factory-startup -P shots/s01_offline_glide.py -- --quality animatic --step 8
    blender -b --factory-startup -P shots/s01_offline_glide.py -- --quality final

Inside the cup, before we know it is a cup. A low glide 1.5 m above a still
espresso sea toward the padlock arch (a silhouette against the backlit paper
cliffs, its padlocks not yet legible), the slot-sun's gold shaft slanting
down the right of frame, foam floes sliding out under the lens. The glide
eases out while the camera tilts up past the arch's crest to the slot,
zooming 19 -> 43.7 mm, and settles with the slot centred, long axis
horizontal, 20% of the frame width. A dark silhouette (fingertips pinching a
folded envelope, env_offline.build_eclipse) slides across the slot and
eclipses it; the world dims and the shaft thins to a ghost; the slot is left as
a thin even bright rim. Hard match cut to S02's lid at f129: measured on proofs,
S01's dark silhouette (19.0% of the width, centre 0.498/0.498) sits on S02's dark
slot (17.9%, centre 0.500/0.503), both long axis horizontal, S02's slot edge
landing on S01's bright rim.

Frame by frame (film frames; 90 BPM, a beat every 16 frames, beat b starts at 16b+1):
  f1-8      black (written directly, nothing to render)
  f9-20     fade up (a compositor exposure ramp, -9 EV -> 0, eased): the glitter path
            arrives first, then the arch's silhouette and the paper
  f9-80     the glide: 3 m/s straight at the arch (it has been gliding since before
            the fade), level, horizon on the lower third (pitch 10 deg), 19 mm, arch
            just left of centre and the shaft down the right third (the approved
            s01_glide framing); a lens floe slips out of the lower frame about every
            14 frames (f22, 36, 50, 64, 76, 88); the shaft's landing point is off the
            right edge in haze (no island or box is built)
  f81       beat 5: tilt, zoom and the dolly's ease-out start together (zero speed and
            acceleration at the start; the zoom trails the tilt slightly)
  f88-104   quickest part of the tilt (1.9 deg/frame, shutter shortened to 0.3):
            up the cliff past the arch's crest, the lid's ribbed vault and the slot
            come down into frame
  f104      the eclipse starts: the slot, sky, sun, shaft, paper and the three colour
            blooms begin to dim together (key_slot to 0.3; the shaft to 0.12; the
            blooms to half); the giant hand's soft shade starts across the lid
  f106      the silhouette's rounded leading edge reaches the slot (one straight,
            linear, mechanical slide, from frame RIGHT: see ECLIPSE_FROM)
  f110-116  the camera settles (95% by f112, 98% by f116) while the silhouette crosses
  f124      at rest on CAM_S01; the silhouette covers the slot, fingertip and thumb
            notches at its right end; only the even bright rim of sky remains;
            ~50% darker frame than at f108 (display mean)
  f124-128  locked hold (identical frames): the rim, the dark vault, the ghost shaft
  f129      cut to S02 (shots/s02_lid_reveal.py) on beat 8

ECLIPSE_FROM: the treatment says the silhouette enters from frame left, but S02 (as
built) has the fingers reach in over the lid from frame right. Seen from inside the
cup the S01 lens has the lid's centre at the top of frame and S02 (from above) has it
at the bottom: the cut flips the frame vertically and keeps left and right. So for the
silhouette to "become the real fingers" it has to come from the right; set
ECLIPSE_FROM = 'left' for the treatment's literal direction (then S02's hand should
come from frame left too).

Camera: one camera, keyed on every frame (location on the glide line through the
slot and the arch, yaw/pitch with no roll, log-even zoom). Deep focus (no DOF).
Sampling: final and hero use the Offline fixed seed on the glide and the hold (the
paper and the arch barely move: no boil); the tilt (f81-123) takes a new seed per
frame, so no denoiser residue rides on the screen while the world slides under it.
"""

import json
import math
import os
import sys
import time

import bpy
from mathutils import Euler, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'lib'))

import common as C  # noqa: E402
import env_offline as E  # noqa: E402

SHOT = 's01'
INFO = next(s for s in json.load(open(os.path.join(HERE, 'shots.json'))) if s['id'] == SHOT)
START, END = INFO['start'], INFO['end']

# ------------------------------------------------------------------ sync points (film frames)
BLACK_END = 8            # f1-8 black
FADE = (8, 20)           # exposure ramp: black at f8, full at f20 (f9 is the first visible frame)
FADE_EV = -9.0
TILT = (80, 124)         # tilt, zoom and dolly ease-out (first moving frame f81, at rest from f124)
ECLIPSE = (104, 124)     # the eclipse move (env_offline.build_eclipse): starts / covers the slot
ECLIPSE_FROM = 'right'   # screen side the silhouette slides in from (see the note in the docstring)
ECLIPSE_TRAVEL = 170.0   # m (slot frame, 120 m beyond the slot): its leading edge reaches the slot at ~f106
ECLIPSE_LEVEL = float(os.environ.get('S01_ECLIPSE_LEVEL', 0.3))  # slot level at full eclipse (key_slot)
SHAFT_ECLIPSED = 0.12    # the shaft at full eclipse, x nominal: only the rim still lets light through
BLOOMS_ECLIPSED = 0.5    # the colour blooms in the paper at full eclipse, x their glide level
SHUTTER = ((84, 0.5), (90, 0.3), (102, 0.3), (110, 0.5))   # shorter shutter through the quickest tilt
HAND_SHADE = 0.42        # the giant hand's soft shade on the translucent lid (0 = none)
HAND_SOFT = 170.0        # m: its penumbra (the hand is 100-250 m beyond the lid, under a broad skylight)
LOOK_KEYS = (104, 120)   # glare eases from the day look to the slot look (env_offline framing 's01_slot')

# ------------------------------------------------------------------ camera
SPEED = 3.0                       # m/s, treatment
GLIDE_LENS = 19.0                 # accepted lens change (treatment 21 mm)
GLIDE_PITCH = 10.0                # deg: horizon on the lower third at 19 mm (the s01_glide framing)
GLIDE_YAW_OFF = -4.0              # deg off the slot azimuth: arch just left of centre, shaft down the right third
END_LOC, END_LENS = E.slot_match_camera()          # CAM_S01 at 1.5 m, 43.7 mm: slot 20% of the width
_to_slot = E.SLOT_C - END_LOC
END_YAW = math.degrees(math.atan2(_to_slot.y, _to_slot.x))
END_PITCH = math.degrees(math.asin(_to_slot.normalized().z))
BACK = Vector((E._u.x, E._u.y, 0.0)).normalized()  # away from the slot along the glide line
DECEL_DIST = SPEED * (TILT[1] - TILT[0]) / C.FPS * 0.5   # 2.75 m under the smoothstep ease-out

# lens floes: (frame its centre slips out of the lower frame, lateral offset m (+ right of the path), size m)
FLOES = ((22, -2.3, 1.4), (36, 3.0, 2.0), (50, -4.8, 2.2), (64, 1.7, 1.2), (76, -1.2, 1.7), (88, 4.4, 1.9))
SENSOR = 36.0
ASPECT = 16.0 / 9.0


def remaining(f):
    """Distance (m) still to glide at frame f (0 from TILT[1] on); speed 3 m/s, then a smoothstep ease-out."""
    if f <= TILT[0]:
        return DECEL_DIST + (TILT[0] - f) * SPEED / C.FPS
    if f >= TILT[1]:
        return 0.0
    t = (f - TILT[0]) / (TILT[1] - TILT[0])
    T = (TILT[1] - TILT[0]) / C.FPS
    return SPEED * T * (0.5 - t + t ** 3 - 0.5 * t ** 4)


TILT_SHAPE = (1.2, 2.2)           # speed ~ u^a (1-u)^b: quickest in the first third (1.9 deg/frame), then a long settle


def move_progress(u, a=TILT_SHAPE[0], b=TILT_SHAPE[1], n=600):
    """0 -> 1 for linear time u in 0..1, speed ~ u^a (1-u)^b: starts and stops with zero speed and
    acceleration, swings up quickest while the wall and shaft are in frame and settles slowly, so the
    slot is nearly still by the time the silhouette crosses it (f106-124)."""
    u = min(1.0, max(0.0, u))
    if u <= 0.0 or u >= 1.0:
        return u
    tot = acc = 0.0
    k = min(n - 1, int(u * n))
    for i in range(n):
        x = (i + 0.5) / n
        v = x ** a * (1.0 - x) ** b
        tot += v
        if i < k:
            acc += v
        elif i == k:
            acc += (u * n - k) * v
    return acc / tot


def tilt_progress(f):
    """0 -> 1 over TILT (pitch and yaw)."""
    return move_progress((f - TILT[0]) / (TILT[1] - TILT[0]))


def zoom_progress(f):
    """The zoom trails the tilt a little: the tilt reveals the shaft and the vault, the zoom settles on the slot."""
    return move_progress(min(1.0, max(0.0, (f - TILT[0]) / (TILT[1] - TILT[0]))) ** 1.35)


def cam_state(f):
    """(location, rotation_euler, lens) at film frame f. No roll ever: X = 90 + pitch, Z = yaw - 90."""
    loc = END_LOC + BACK * remaining(f)
    s = tilt_progress(f)
    yaw = END_YAW + GLIDE_YAW_OFF * (1.0 - s)
    pitch = GLIDE_PITCH + (END_PITCH - GLIDE_PITCH) * s
    z = zoom_progress(f)
    lens = GLIDE_LENS * (END_LENS / GLIDE_LENS) ** z          # zoom even in log focal length
    rot = (math.radians(90.0 + pitch), 0.0, math.radians(yaw - 90.0))
    return loc, rot, lens


def path_point(f, ahead=0.0, lateral=0.0):
    """World (x, y) `ahead` m in front of the frame-f lens along the glide, `lateral` m to its right."""
    loc = END_LOC + BACK * remaining(f)
    fwd = -BACK
    right = Vector((fwd.y, -fwd.x, 0.0))
    p = loc + fwd * ahead + right * lateral
    return (p.x, p.y)


def project(f, p):
    """Frame-f screen position (x right, y down, 0..1) and depth of world point p (pure math, no scene)."""
    loc, rot, lens = cam_state(f)
    m = Euler(rot, 'XYZ').to_matrix()
    v = m.transposed() @ (Vector(p) - loc)
    depth = -v.z
    k = 2.0 * lens / SENSOR
    return 0.5 + 0.5 * k * v.x / depth, 0.5 - 0.5 * k * ASPECT * v.y / depth, depth


def lens_floes():
    """Floes whose centres slip out of the lower frame at the listed frames (one about every beat)."""
    out = []
    for f, o, sz in FLOES:
        lo, hi = 0.5, 30.0                      # metres ahead of the frame-f lens (bisection on the exit)
        for _ in range(40):
            mid = 0.5 * (lo + hi)
            x, y, _d = project(f, path_point(f, mid, o) + (0.0,))
            if y > 1.0:
                lo = mid
            else:
                hi = mid
        out.append(path_point(f, 0.5 * (lo + hi), o) + (sz,))
    return out


def key_camera(cam):
    for f in range(START, END + 1):
        loc, rot, lens = cam_state(f)
        cam.location = loc
        cam.rotation_euler = rot
        cam.data.lens = lens
        cam.keyframe_insert('location', frame=f)
        cam.keyframe_insert('rotation_euler', frame=f)
        cam.data.keyframe_insert('lens', frame=f)
    for owner in (cam, cam.data):
        for fc in C.fcurves(owner.animation_data.action):
            for kp in fc.keyframe_points:
                kp.interpolation = 'LINEAR'


def key_fade(sc):
    """Fade up from black on an exposure ramp at the very end of the compositor (after glare and mist)."""
    nt = sc.node_tree
    comp = next(n for n in nt.nodes if n.bl_idname == 'CompositorNodeComposite')
    src = comp.inputs['Image'].links[0].from_socket
    ex = nt.nodes.new('CompositorNodeExposure')
    ex.name = 'S01_Fade'
    nt.links.new(src, ex.inputs['Image'])
    nt.links.new(ex.outputs['Image'], comp.inputs['Image'])
    sock = ex.inputs['Exposure']
    for f, v in ((FADE[0], FADE_EV), (FADE[1], 0.0)):
        sock.default_value = v
        sock.keyframe_insert('default_value', frame=f)
    for fc in C.fcurves(nt.animation_data.action):
        if 'S01_Fade' in fc.data_path:
            for kp in fc.keyframe_points:
                kp.interpolation = 'BEZIER'
                kp.handle_left_type = kp.handle_right_type = 'AUTO_CLAMPED'
    return ex


def key_look(sc):
    """Glare eases from the day look to the slot look (env_offline framing 's01_slot') as the slot arrives."""
    day = E.look('day')
    slot = dict(day)
    slot.update(E.framing('s01_slot').get('look', {}))
    g = next((n for n in sc.node_tree.nodes if n.bl_idname == 'CompositorNodeGlare'), None)
    if g is None or 'Strength' not in g.inputs:
        return
    for f, lk in ((LOOK_KEYS[0], day), (LOOK_KEYS[1], slot)):
        for sock, k in (('Threshold', 'glare_threshold'), ('Strength', 'glare'), ('Size', 'glare_rel_size')):
            g.inputs[sock].default_value = lk[k]
            g.inputs[sock].keyframe_insert('default_value', frame=f)


def stage_eclipse(h):
    """The S01 eclipse (env_offline.build_eclipse), entering from ECLIPSE_FROM, the shaft thinned
    to SHAFT_ECLIPSED at full cover, and the hand's soft shade crossing the lid with it."""
    rig = E.build_eclipse(h, f0=ECLIPSE[0], f1=ECLIPSE[1], level=ECLIPSE_LEVEL, travel=ECLIPSE_TRAVEL)
    if ECLIPSE_FROM == 'right':
        # turn the whole silhouette half round the slot normal (hand, fingertip notches and fingers
        # now trail to the right) and slide it in from the right: the S02 fingers reach in from the right
        rig.animation_data_clear()
        rig.rotation_euler = (0.0, 0.0, math.pi)
        for f, x in ((ECLIPSE[0], ECLIPSE_TRAVEL), (ECLIPSE[1], 0.0)):
            rig.location = (x, 0.0, 0.0)
            rig.keyframe_insert('location', frame=f)
        for fc in C.fcurves(rig.animation_data.action):
            for kp in fc.keyframe_points:
                kp.interpolation = 'LINEAR'
    sh = h['mats'].get('shaft')
    if sh is not None:
        E.key_value(sh.node_tree.nodes['ShaftStrength'], ECLIPSE[1], h['nominal']['shaft'] * SHAFT_ECLIPSED, 'BEZIER')
    lv = E.framing('s01_glide').get('blooms', {})
    for name, level in lv.items():
        E.key_bloom(h, name, ECLIPSE[0], level, 'BEZIER')
        E.key_bloom(h, name, ECLIPSE[1], level * BLOOMS_ECLIPSED, 'BEZIER')
    if HAND_SHADE > 0:
        shade_lid(h['mats']['lid'], rig)
    return rig


def shade_lid(mat, rig):
    """Multiply the lid's backlit glow by the giant hand's soft shade (rig space: the envelope plate
    over the slot and the hand trailing along -X to 420 m, both 120 m beyond the slot plane). The
    lid's emission is what the camera sees of the room light through the plastic, so whatever
    blocks that light outside darkens it. The slot rim glow is left alone (the rim must stay crisp)."""
    nt = mat.node_tree
    glow = nt.nodes['LidGlow'].outputs[0]
    dst = [lk.to_socket for lk in glow.links]
    tc = nt.nodes.new('ShaderNodeTexCoord')
    tc.object = rig
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Object'], sep.inputs[0])

    def math_(op, a, b=None):
        n = nt.nodes.new('ShaderNodeMath')
        n.operation = op
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = float(v)
            else:
                nt.links.new(v, n.inputs[i])
        return n.outputs[0]

    def box_dist(cx, hx, hy):        # distance (m) from a rounded box centred at (cx, 0) in rig XY
        dx = math_('MAXIMUM', math_('SUBTRACT', math_('ABSOLUTE', math_('SUBTRACT', sep.outputs[0], cx)), hx), 0.0)
        dy = math_('MAXIMUM', math_('SUBTRACT', math_('ABSOLUTE', sep.outputs[1]), hy), 0.0)
        return math_('SQRT', math_('ADD', math_('MULTIPLY', dx, dx), math_('MULTIPLY', dy, dy)))
    d = math_('MINIMUM', box_dist(0.0, 66.0, 21.0), box_dist(-250.0, 170.0, 40.0))
    t = math_('MINIMUM', math_('DIVIDE', d, HAND_SOFT), 1.0)
    ss = math_('MULTIPLY', math_('MULTIPLY', t, t), math_('SUBTRACT', 3.0, math_('MULTIPLY', t, 2.0)))
    shade = math_('ADD', 1.0 - HAND_SHADE, math_('MULTIPLY', ss, HAND_SHADE))
    out = math_('MULTIPLY', glow, shade)
    for s_ in dst:
        nt.links.new(out, s_)


def key_shutter(sc):
    """Motion blur shutter: the film's 0.5, shortened through the quickest part of the tilt."""
    for f, v in SHUTTER:
        sc.render.motion_blur_shutter = v
        sc.render.keyframe_insert('motion_blur_shutter', frame=f)


def key_seed(sc):
    """Fixed seed where the frame is (near) still, a fresh seed per frame through the tilt."""
    cy = sc.cycles
    if cy.use_animated_seed:          # proof/animatic: Cycles already varies it
        return

    def on_frame(scene, *rest):
        f = scene.frame_current
        scene.cycles.seed = f if TILT[0] < f < TILT[1] else 0
    bpy.app.handlers.frame_change_pre.append(on_frame)


def build(args):
    t0 = time.time()
    sc = C.new_scene(START, END, args.quality, samples=args.samples, threads=args.threads)
    glide = E.framing('s01_glide')
    slot = E.framing('s01_slot')
    include = set(glide['include']) | set(slot['include'])
    path = [path_point(f) for f in range(START, TILT[1] + 1, 8)]
    mid = path_point((BLACK_END + TILT[0]) // 2)
    kw = E.build_kwargs(glide)
    kw.update(sea_focus=mid, floes_near=path, floes_lens=lens_floes())
    h = E.build_offline('day', include=include, frames=(START, END), **kw)
    E.tune_render(sc, args.quality, args.samples)
    stage_eclipse(h)
    E.apply_fills(h, glide.get('fills'))
    E.apply_values(h, glide.get('values'))
    E.apply_light_levels(h, glide.get('lights'))
    loc, rot, lens = cam_state(START)
    cam = E.camera_offline(lens, loc, loc + Vector((0, 1, 0)))
    key_camera(cam)
    E.set_shaft_camera(h, True)
    E.apply_look('day')
    key_look(sc)
    key_fade(sc)
    key_seed(sc)
    key_shutter(sc)
    print(f'S01 BUILD {time.time() - t0:.1f}s end lens {END_LENS:.2f} mm, end pitch {END_PITCH:.2f} deg, '
          f'end yaw {END_YAW:.2f} deg, glide {remaining(START):.2f} m', flush=True)
    return h


def write_black(args, frames):
    """f1-8 are black: write them directly at the tier's resolution."""
    sc = bpy.context.scene
    w, hgt = sc.render.resolution_x, sc.render.resolution_y
    out_dir = os.path.join(os.path.abspath(args.out), SHOT)
    os.makedirs(out_dir, exist_ok=True)
    img = bpy.data.images.new('S01_Black', w, hgt, alpha=False)
    img.pixels.foreach_set([0.0, 0.0, 0.0, 1.0] * (w * hgt))
    img.file_format = 'PNG'
    for f in frames:
        path = os.path.join(out_dir, f'{f:04d}.png')
        img.filepath_raw = path
        img.save()
        print(f'RENDERED {SHOT} {f} {path} (black)', flush=True)
    bpy.data.images.remove(img)


if __name__ == '__main__':
    a = C.shot_args()
    build(a)
    frames = C.frame_list(a, START, END)
    if not a.no_render:
        write_black(a, [f for f in frames if f <= BLACK_END])
    rest = [f for f in frames if f > BLACK_END]
    if rest or a.save_blend:
        a.only = ','.join(map(str, rest))
        if not rest:
            a.no_render = True
        t0 = time.time()
        C.render(SHOT, a, START, END)
        if rest and not a.no_render:
            print(f'S01 RENDER {len(rest)} frames {time.time() - t0:.1f}s '
                  f'({(time.time() - t0) / len(rest):.1f}s/frame)', flush=True)
