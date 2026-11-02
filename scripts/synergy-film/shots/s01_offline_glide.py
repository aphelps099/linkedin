"""S01 · f1-128 · 0.00-5.33 s · E1_OFFLINE (day): the glide and the eclipse.

    blender -b --factory-startup -P shots/s01_offline_glide.py -- --quality proof --only 9,12,16,20,50,80,88,96,104,106,108,112,116,120,124,128
    blender -b --factory-startup -P shots/s01_offline_glide.py -- --quality animatic --step 8
    blender -b --factory-startup -P shots/s01_offline_glide.py -- --quality final

Inside the cup, before we know it is a cup. A low glide 1.5 m above a still
espresso sea toward the padlock arch (a hazed silhouette against the backlit
paper cliffs, its padlocks not legible), the slot-sun's gold shaft slanting
down the right of frame, crema streaks, bubbles and small foam floes sliding
under the lens. The glide eases out while the camera tilts up past the arch's
crest to the slot, zooming 19 -> 38.7 mm, and is at rest by f113 with the slot
centred, long axis horizontal, 17.7% of the frame width. The slot burns with a
warm halation on the vault. From f104 the soft shadow of a giant thumb and index
finger slides over the backlit lid from the lower right, and through the slot
the folded edge of an envelope (a straight diagonal, top end leading) sweeps
across the sun from frame right; the world dims and the shaft thins to a ghost.
At rest (f124) the envelope fills the slot: the sky survives as two thin bright
lines along its long edges, broken by the index fingertip (top edge) and the
thumb pad (bottom edge), offset and of different size, and the lit cut edge of
the plastic outlines both ends. Hard match cut to S02's lid at f129.

Frame by frame (film frames; 90 BPM, a beat every 16 frames, beat b starts at 16b+1):
  f1-8      black (written directly, nothing to render)
  f9-20     fade up: a compositor exposure ramp keyed per frame so the display brightness
            rises evenly from f9 (first visible frame, ~7% of full) to full at f20 (proof
            display means f9 0.029, f12 0.133, f16 0.278, f20 0.404)
  f9-80     the glide: 3 m/s straight at the arch (it has been gliding since before the
            fade), level, horizon on the lower third (pitch 10 deg), 19 mm, arch just left
            of centre and the shaft down the right third (the approved s01_glide framing).
            Near field: crema streaks and bubbles on the water 4-30 m out and a small lens
            floe every ~5 frames (LENS_FLOES: some exit through the side edges), plus finer
            capillaries near the lens, so the travel reads continuously. The shaft's landing
            point is off the right edge in haze (no island or box is built)
  f81       beat 5: tilt, zoom and the dolly's ease-out start together (zero speed and
            acceleration at the start; the zoom trails the tilt slightly)
  f84-96    quickest part of the tilt (peak 2.9 deg/frame at f88-89): up the cliff past the arch's
            crest, the lid's ribbed vault and the burning slot come down into frame
  f104      the eclipse starts: the slot, sky, sun, shaft, paper and the three colour blooms
            begin to dim together (key_slot to 0.3; the shaft to 0.12; the blooms to half);
            the hand's shadow fades in on the lid (full by f110), converging from the lower right
  f106      the envelope's straight leading edge (25 deg off vertical, top end leading)
            touches the slot's right end; one straight, linear, mechanical slide leftwards
  f113      beat 7: the camera is at rest (pitch 55.8 deg, 38.7 mm); the eclipse plays on a
            locked frame from here (the slot is within 3 px of rest from f108, 0.5 px from f110)
  f117-124  the index fingertip (f117), then the thumb pad (f120), slide in along the slivers of sky
  f124      at rest: the envelope covers the slot (thin sky lines along both long edges,
            broken by the two pads); the halation is gone; ~50% darker frame than at f106
  f125-128  locked hold (identical frames from f125; f124 still carries the last
            quarter-frame of motion blur on the fingertips)
  f129      cut to S02 (shots/s02_lid_reveal.py) on beat 8

Match cut: S02 (as built) frames its slot at 20% of the width geometrically, but its
dark opening reads 17.6% wide (bevel): 141 x 42 px at 800, centred 0.5006/0.5044 (proof,
dark < 0.2). S01's dark shape is the whole slot minus the two sky lines, so END_FRAC =
0.177 makes it the same size (4587 px of pure black against S02's 4571, 42 px tall in
both, bbox 144 px wide against 141) and END_SHIFT lowers it by 0.0044 of the frame height
(centres 0.501/0.504 in both). S01's bright outline lands on S02's grey bevel. Re-measure
both frames if S02's framing changes (dark < 0.06 for S01: the hand's shadow round the slot
is itself darker than 0.2).

ECLIPSE_FROM: the silhouette enters from frame RIGHT (the treatment's 'from frame left'
is superseded): S02's fingers reach in over the lid from frame right, and seen from
inside the cup the S01 lens has the lid's centre at the top of frame while S02 (from
above) has it at the bottom, so the cut flips the frame vertically and keeps left and
right. The hand's shadow comes from the lower right for the same reason (S02's fingers
enter upper right).

Shot-side changes to the built world (env_offline is not edited):
  * the shaft prism pokes 10-20 m out through the slot (its first ring is not on the
    slot plane): its emission fades out over the last 20 m before the slot plane, and over
    the last 160 m at full eclipse (its stub beside the slot's right end read as a grey nub
    on the rim); its colour is warmed to gold-white and its cross profile softened;
  * the floe ring quads are wound opposite to the centre fans (dark 'sunburst' on every
    floe under smooth shading): the floe normals are recalculated to face up; the foam is
    made matte;
  * the arch is a silhouette: albedo x0.07, no warm key or glitter lamp on it (light
    linking), its sprung-open shackles closed and the padlocks on its scree hidden, a slight
    atmospheric blur of its outline and +10% haze (compositor, object index 11);
  * the lid: the hand's shadow and the sun's halation are added to its glow, and the lit cut
    edge continues round the flared part of the hole (lid_rim).

Camera: one camera, keyed on every frame (location on the glide line through the
slot and the arch, yaw/pitch with no roll, log-even zoom, lens shift easing to
END_SHIFT). Deep focus (no DOF). Sampling: final and hero use the Offline fixed seed
on the glide and from f113 on (the paper and the arch barely move, the camera is
still: no boil); the tilt (f81-112) takes a new seed per frame, so no denoiser residue
rides on the screen while the world slides under it.
"""

import json
import math
import os
import sys
import time

import bmesh
import bpy
import numpy as np
from mathutils import Euler, Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(os.path.dirname(HERE), 'lib'))

import common as C  # noqa: E402
import env_offline as E  # noqa: E402

SHOT = 's01'
INFO = next(s for s in json.load(open(os.path.join(HERE, 'shots.json'))) if s['id'] == SHOT)
START, END = INFO['start'], INFO['end']

# ------------------------------------------------------------------ sync points (film frames)
BLACK_END = 8            # f1-8 black
# fade up: compositor exposure (EV) per frame, so the display brightness rises about evenly from f9
# (first visible frame) to full at f20 (measured on proofs: EV -4.8 reads ~0.035, 0 reads ~0.42)
FADE_EV = {8: -9.0, 9: -4.8, 10: -3.7, 11: -3.0, 12: -2.5, 13: -2.05, 14: -1.65, 15: -1.3, 16: -1.0,
           17: -0.7, 18: -0.43, 19: -0.2, 20: 0.0}
TILT = (80, 113)         # tilt, zoom and dolly ease-out (first moving frame f81, at rest from f113 = beat 7)
ECLIPSE = (104, 124)     # the eclipse move: starts / covers the slot (the slide is linear between them)
ECLIPSE_CONTACT = 106    # the envelope's leading edge touches the slot's right end
ECLIPSE_FROM = 'right'   # screen side the silhouette slides in from (see the note in the docstring)
ECLIPSE_LEVEL = float(os.environ.get('S01_ECLIPSE_LEVEL', 0.3))  # slot level at full eclipse (key_slot)
SHAFT_ECLIPSED = 0.12    # the shaft at full eclipse, x nominal: only the rim still lets light through
BLOOMS_ECLIPSED = 0.5    # the colour blooms in the paper at full eclipse, x their glide level
SLOT_GLOW_REST = 0.55    # the lit cut edge of the plastic at rest (x nominal): it outlines the slot's ends
SHUTTER = ((84, 0.5), (88, 0.45), (96, 0.45), (102, 0.5))   # a little shorter through the quickest tilt
LOOK_KEYS = (104, 120)   # glare eases from the day look to the slot look (env_offline framing 's01_slot')

# ------------------------------------------------------------------ the eclipse silhouette
# Slot-plane metres as seen from the end lens (x right, y down on screen; the slot is the stadium
# |x| <= 45 + 22.5, |y| <= 22.5), at rest. The geometry sits SIL_DEPTH m beyond the slot plane,
# scaled up by perspective so it projects to these outlines.
SIL_DEPTH = 120.0
CARD_RIM = (1.6, 1.8)        # m of sky left between the envelope's long edges and the slot's top / bottom edges
CARD_SLANT = 25.0            # deg off vertical: the envelope's leading folded edge, its top end leading
CARD_LEAD = -72.5            # x of the leading edge on the slot axis at rest: just past the left end
CARD_TAIL = 420.0            # x of the trailing edge at rest (far behind the lid)
PAD_INDEX = (5.0, 18.0, 1.9)    # index fingertip on the top edge: x at rest, radius, how far it pokes past the edge
PAD_THUMB = (35.0, 24.0, 2.0)   # thumb pad on the bottom edge (30 m further right, larger)
# the hand's soft shadow on the backlit lid (rig space = slot plane at rest): capsules (tip, base, radii)
# (a pinch seen from behind paper: the index arcs over the slot's top edge, the thumb under its bottom
# edge, both curling in from the hand, which reaches in from the lid's rim at the lower right; the web
# closes them into a 'C' round a lens of bright lid; each finger is a chain of tapered phalanges with
# slightly fuller joints, so the outline reads as fingers, not bars)
FINGER_INDEX = ((5.0, -28.0, 13.0), (65.0, -44.0, 14.5), (130.0, -40.0, 16.0), (195.0, -15.0, 18.0))
FINGER_THUMB = ((35.0, 30.0, 16.0), (95.0, 52.0, 18.5), (150.0, 60.0, 21.0), (205.0, 40.0, 24.0))
KNUCKLE_GROW = 1.6       # m: joints a little fuller than the phalanges either side
WEB = ((195.0, -15.0), (205.0, 40.0), 30.0, 30.0)
PALM = ((215.0, 15.0), (340.0, 130.0), 50.0, 60.0)
SHADE_FINGERS = 0.7      # darkening inside the hand's shadow (the lid's glow x (1 - this))
SHADE_CARD = 0.0         # darkening under the envelope's shadow (off: it would fill the lens inside the 'C')
SHADE_SOFT = (12.0, 30.0)   # penumbra (m) of the hand's and the envelope's shadow
SHADE_ARRIVE = (104, 110)   # the shadow fades in with the slide (no shade before the hand is near)
# the sun's warm halation on the vault round the uncovered slot (lid emission, f96-112, gone at f123)
HALO = dict(strength=3.6, near=12.0, far=55.0, near_w=0.55, kelvin=3200)
HALO_KEYS = ((ECLIPSE_CONTACT, 1.0), (123, 0.0))

# ------------------------------------------------------------------ camera
SPEED = 3.0                       # m/s, treatment
GLIDE_LENS = 19.0                 # accepted lens change (treatment 21 mm)
GLIDE_PITCH = 10.0                # deg: horizon on the lower third at 19 mm (the s01_glide framing)
GLIDE_YAW_OFF = -4.0              # deg off the slot azimuth: arch just left of centre, shaft down the right third
END_FRAC = 0.177                  # slot width / frame width at rest: S01's dark shape = S02's dark slot
END_SHIFT = (0.0008, 0.0028)      # lens shift at rest (x, y; fraction of the width): the slot 1.3 px left, 0.0044 H lower
END_LOC, END_LENS = E.slot_match_camera(frac=END_FRAC)      # CAM_S01 at 1.5 m, 38.7 mm
_to_slot = E.SLOT_C - END_LOC
END_YAW = math.degrees(math.atan2(_to_slot.y, _to_slot.x))
END_PITCH = math.degrees(math.asin(_to_slot.normalized().z))
BACK = Vector((E._u.x, E._u.y, 0.0)).normalized()  # away from the slot along the glide line
DECEL_DIST = SPEED * (TILT[1] - TILT[0]) / C.FPS * 0.5   # 2.06 m under the smoothstep ease-out

# lens floes: (frame its centre leaves the frame, screen x, screen y of that exit, size m); a small one
# about every 5 frames, some through the side edges for parallax
LENS_FLOES = ((12, 0.30, 1.03, 0.6), (17, 0.93, 1.03, 0.4), (22, 0.12, 1.03, 0.75), (27, 1.04, 0.86, 0.45),
              (31, 0.55, 1.03, 0.5), (36, 0.80, 1.03, 0.9), (41, -0.04, 0.88, 0.5), (45, 0.38, 1.03, 0.4),
              (50, 0.18, 1.03, 1.0), (55, 0.66, 1.03, 0.55), (60, 1.04, 0.90, 0.6), (64, 0.45, 1.03, 0.7),
              (69, 0.06, 1.03, 0.45), (73, 0.86, 1.03, 0.8), (78, 0.30, 1.03, 0.55), (83, 0.62, 1.03, 0.45),
              (87, -0.04, 0.92, 0.6))
SPECK_STREAKS = 900      # crema streaks on the water near the lens (4-30 m out)
SPECK_BUBBLES = 1500     # loose crema bubbles
CAPILLARY_NEAR = (24.0, 5.0)     # m from the lens: finer, stronger capillaries fade in over this range
ARCH_FILL = 0.07         # albedo scale of the arch's stone and padlocks (framing: 0.3 / 0.35)
ARCH_HAZE = 0.10         # extra aerial haze on the arch (compositor, its own object index)
ARCH_SOFTEN = 0.002      # and an atmospheric softening of its outline (blur, fraction of the width)
ARCH_INDEX = 11
SHAFT_WARM = 0.72        # shaft colour: 0.35 (library) -> this toward 3600 K: gold-white
SHAFT_EDGE = 2.4         # exponent of the beam's cross profile (library 1.5): softer edges
SHAFT_CLIP = 20.0        # m: the shaft's emission fades out over this distance before the slot plane
SHAFT_CLIP_ECLIPSED = 160.0   # m: ... and over this distance at full eclipse
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


TILT_SHAPE = (1.0, 3.0)           # speed ~ u^a (1-u)^b: quickest at f88-90 (2.9 deg/frame), settled by f108


def move_progress(u, a=TILT_SHAPE[0], b=TILT_SHAPE[1], n=600):
    """0 -> 1 for linear time u in 0..1, speed ~ u^a (1-u)^b: starts and stops with zero speed and
    acceleration, swings up quickest while the wall and shaft are in frame and settles, so the
    slot is still before the envelope covers more than a sliver of it."""
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
    """0 -> 1 over TILT (pitch, yaw and lens shift)."""
    return move_progress((f - TILT[0]) / (TILT[1] - TILT[0]))


def zoom_progress(f):
    """The zoom trails the tilt a little: the tilt reveals the shaft and the vault, the zoom settles on the slot."""
    return move_progress(min(1.0, max(0.0, (f - TILT[0]) / (TILT[1] - TILT[0]))) ** 1.35)


def cam_state(f):
    """(location, rotation_euler, lens, shift) at film frame f. No roll ever: X = 90 + pitch, Z = yaw - 90."""
    loc = END_LOC + BACK * remaining(f)
    s = tilt_progress(f)
    yaw = END_YAW + GLIDE_YAW_OFF * (1.0 - s)
    pitch = GLIDE_PITCH + (END_PITCH - GLIDE_PITCH) * s
    z = zoom_progress(f)
    lens = GLIDE_LENS * (END_LENS / GLIDE_LENS) ** z          # zoom even in log focal length
    rot = (math.radians(90.0 + pitch), 0.0, math.radians(yaw - 90.0))
    return loc, rot, lens, (END_SHIFT[0] * s, END_SHIFT[1] * s)


def path_point(f, ahead=0.0, lateral=0.0):
    """World (x, y) `ahead` m in front of the frame-f lens along the glide, `lateral` m to its right."""
    loc = END_LOC + BACK * remaining(f)
    fwd = -BACK
    right = Vector((fwd.y, -fwd.x, 0.0))
    p = loc + fwd * ahead + right * lateral
    return (p.x, p.y)


def project(f, p):
    """Frame-f screen position (x right, y down, 0..1) and depth of world point p (pure math, no scene)."""
    loc, rot, lens, sh = cam_state(f)
    m = Euler(rot, 'XYZ').to_matrix()
    v = m.transposed() @ (Vector(p) - loc)
    depth = -v.z
    k = 2.0 * lens / SENSOR
    return 0.5 + 0.5 * k * v.x / depth - sh[0], 0.5 - 0.5 * k * ASPECT * v.y / depth + sh[1] * ASPECT, depth


def water_point(f, sx, sy, z=0.08):
    """World (x, y) of the water (height z) seen at screen (sx, sy) at frame f (pure math)."""
    loc, rot, lens, sh = cam_state(f)
    m = Euler(rot, 'XYZ').to_matrix()
    k = 2.0 * lens / SENSOR
    d = m @ Vector((((sx - 0.5) * 2.0 + 2.0 * sh[0]) / k, (-(sy - 0.5) * 2.0 + 2.0 * sh[1] * ASPECT) / (k * ASPECT), -1.0))
    t = (z - loc.z) / d.z
    p = loc + d * t
    return (p.x, p.y)


def lens_floes():
    """Floes whose centres leave the frame at the listed frames and screen points."""
    return [water_point(f, sx, sy) + (sz,) for f, sx, sy, sz in LENS_FLOES]


def key_camera(cam):
    for f in range(START, END + 1):
        loc, rot, lens, sh = cam_state(f)
        cam.location = loc
        cam.rotation_euler = rot
        cam.data.lens = lens
        cam.data.shift_x, cam.data.shift_y = sh
        cam.keyframe_insert('location', frame=f)
        cam.keyframe_insert('rotation_euler', frame=f)
        for p in ('lens', 'shift_x', 'shift_y'):
            cam.data.keyframe_insert(p, frame=f)
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
    for f, v in sorted(FADE_EV.items()):
        sock.default_value = v
        sock.keyframe_insert('default_value', frame=f)
    for fc in C.fcurves(nt.animation_data.action):
        if 'S01_Fade' in fc.data_path:
            for kp in fc.keyframe_points:
                kp.interpolation = 'LINEAR'
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


# ------------------------------------------------------------------ node helpers on built materials

def graph(mat):
    """env_offline's node builder on an existing material (without clearing it)."""
    g = E.G.__new__(E.G)
    g.mat, g.nt = mat, mat.node_tree
    g.out = next(n for n in g.nt.nodes if n.bl_idname == 'ShaderNodeOutputMaterial')
    return g


def key_node_value(node, keys, interp='BEZIER'):
    for f, v in keys:
        E.key_value(node, f, v, interp)


# ------------------------------------------------------------------ the eclipse

def sil_scale(depth):
    """Perspective scale for geometry `depth` m beyond the slot plane (the end lens is on the slot axis)."""
    D = (E.SLOT_C - END_LOC).length
    return (D + depth) / D


def card_edges():
    yt, yb = -(22.5 - CARD_RIM[0]), 22.5 - CARD_RIM[1]
    return yt, yb


def contact_travel():
    """Rig travel (slot-plane m) at f104 so the leading edge touches the slot at ECLIPSE_CONTACT.

    The envelope covers points with x - y tan(slant) > X + CARD_LEAD; the slot's support in that
    direction is 45 + 22.5 sqrt(1 + tan^2)."""
    t = math.tan(math.radians(CARD_SLANT))
    support = 45.0 + 22.5 * math.sqrt(1.0 + t * t)
    x_contact = support - CARD_LEAD
    return x_contact * (ECLIPSE[1] - ECLIPSE[0]) / (ECLIPSE[1] - ECLIPSE_CONTACT)


def disc(cx, cy, r, n=48):
    a = np.linspace(0.0, 2.0 * np.pi, n, endpoint=False)
    return np.stack([cx + r * np.cos(a), cy + r * np.sin(a)], 1)


def stage_eclipse(h):
    """The S01 eclipse: env_offline.build_eclipse (the rig, the key_slot dimming), with the rig's
    geometry replaced by the envelope's slanted leading edge and the two offset finger pads, a
    straight linear slide from frame right, the shaft thinned, the blooms halved, and the hand's
    shadow and the sun's halation on the lid."""
    travel = contact_travel()
    k = sil_scale(SIL_DEPTH)
    rig = E.build_eclipse(h, f0=ECLIPSE[0], f1=ECLIPSE[1], level=ECLIPSE_LEVEL, travel=travel * k)
    for ch in list(rig.children):
        bpy.data.objects.remove(ch, do_unlink=True)
    rig.animation_data_clear()
    rig.rotation_euler = (0.0, 0.0, 0.0)
    for f, x in ((ECLIPSE[0], travel), (ECLIPSE[1], 0.0)):
        rig.location = (x * k, 0.0, 0.0)          # projected travel x, at the silhouette's depth
        rig.keyframe_insert('location', frame=f)
    for fc in C.fcurves(rig.animation_data.action):
        for kp in fc.keyframe_points:
            kp.interpolation = 'LINEAR'
    root = C.collection('OFFLINE')
    mat = E.mat_silhouette()
    t = math.tan(math.radians(CARD_SLANT))
    yt, yb = card_edges()
    card = np.array([[CARD_LEAD + yt * t, yt], [CARD_TAIL, yt], [CARD_TAIL, yb], [CARD_LEAD + yb * t, yb]])
    parts = [('S01_EclipseEnvelope', card, SIL_DEPTH)]
    for name, (x, r, poke), edge, sgn in (('S01_EclipseIndex', PAD_INDEX, yt, -1.0), ('S01_EclipseThumb', PAD_THUMB, yb, 1.0)):
        pad = disc(x, edge + sgn * (poke - r), r)
        pad[:, 1] = np.maximum(pad[:, 1], 0.0) if sgn > 0 else np.minimum(pad[:, 1], 0.0)   # its own edge only
        parts.append((name, pad, SIL_DEPTH + 1.0))
    for name, pts, depth in parts:
        kk = sil_scale(depth)
        V = np.c_[pts * kk, np.full(len(pts), depth)]
        ob = E.np_mesh(name, V, [np.arange(len(pts))[None, :]], coll=root, mat=mat, smooth=False)
        ob.parent = rig
        ob.matrix_parent_inverse = Matrix.Identity(4)
        ob.pass_index = E.NO_MIST_INDEX           # a pure dark silhouette: no haze on it
    sh = h['mats'].get('shaft')
    if sh is not None:
        E.key_value(sh.node_tree.nodes['ShaftStrength'], ECLIPSE[1], h['nominal']['shaft'] * SHAFT_ECLIPSED, 'BEZIER')
    lv = E.framing('s01_glide').get('blooms', {})
    for name, level in lv.items():
        E.key_bloom(h, name, ECLIPSE[0], level, 'BEZIER')
        E.key_bloom(h, name, ECLIPSE[1], level * BLOOMS_ECLIPSED, 'BEZIER')
    E.key_value(h['mats']['lid'].node_tree.nodes['SlotGlow'], ECLIPSE[1], SLOT_GLOW_REST, 'BEZIER')
    lid_shade(h, rig)
    lid_halo(h, rig)
    lid_rim(h)
    return rig


def _capsule(g, px, py, a, b, ra, rb):
    """2D distance (m) to a tapered capsule a -> b (radii ra -> rb) in shader nodes."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    L2 = dx * dx + dy * dy
    qx, qy = g.math('SUBTRACT', px, a[0]), g.math('SUBTRACT', py, a[1])
    t = g.math('DIVIDE', g.add(g.mul(qx, dx), g.mul(qy, dy)), L2, clamp=True)
    ex, ey = g.math('SUBTRACT', qx, g.mul(t, dx)), g.math('SUBTRACT', qy, g.mul(t, dy))
    return g.math('SUBTRACT', g.vmath('LENGTH', g.comb(ex, ey, 0.0)), g.add(ra, g.mul(t, rb - ra)))


def _box(g, px, py, x0, x1, y0, y1):
    cx, cy, hx, hy = 0.5 * (x0 + x1), 0.5 * (y0 + y1), 0.5 * (x1 - x0), 0.5 * (y1 - y0)
    ax = g.math('MAXIMUM', g.math('SUBTRACT', g.math('ABSOLUTE', g.math('SUBTRACT', px, cx)), hx), 0.0)
    ay = g.math('MAXIMUM', g.math('SUBTRACT', g.math('ABSOLUTE', g.math('SUBTRACT', py, cy)), hy), 0.0)
    return g.vmath('LENGTH', g.comb(ax, ay, 0.0))


def lid_shade(h, rig):
    """The hand's soft shadow on the backlit lid: the lid's glow is the room light through the plastic,
    so whatever blocks that light outside darkens it. A thumb and an index finger (tapered capsules)
    and the palm converge on the slot from the lower right; the envelope's own shadow is fainter.
    Rig space (slides with the silhouette). The slot's lit cut edge is left alone (the rim stays crisp)."""
    mat = h['mats']['lid']
    g = graph(mat)
    nt = g.nt
    glow = nt.nodes['LidGlow'].outputs[0]
    dst = [lk.to_socket for lk in glow.links]
    px, py, _pz = g.sep(g.texco('Object', rig))
    fingers = g.math('MINIMUM', _capsule(g, px, py, *WEB), _capsule(g, px, py, *PALM))
    for chain in (FINGER_INDEX, FINGER_THUMB):
        for (ax_, ay_, ra), (bx_, by_, rb) in zip(chain[:-1], chain[1:]):
            fingers = g.math('MINIMUM', fingers, _capsule(g, px, py, (ax_, ay_), (bx_, by_), ra, rb))
        for jx, jy, jr in chain[1:-1]:
            knuckle = g.math('SUBTRACT', g.vmath('LENGTH', g.comb(g.math('SUBTRACT', px, jx), g.math('SUBTRACT', py, jy), 0.0)),
                             jr + KNUCKLE_GROW)
            fingers = g.math('MINIMUM', fingers, knuckle)
    yt, yb = card_edges()
    card = _box(g, px, py, CARD_LEAD, CARD_TAIL, yt, yb)
    sf, sc_ = SHADE_SOFT
    dark_f = g.remap(fingers, -0.5 * sf, 0.5 * sf, SHADE_FINGERS, 0.0, smooth=True)
    dark_c = g.remap(card, -0.5 * sc_, 0.5 * sc_, SHADE_CARD, 0.0, smooth=True)
    arrive = g.value(0.0, 'S01_ShadeArrive')
    key_node_value(arrive, ((SHADE_ARRIVE[0], 0.0), (SHADE_ARRIVE[1], 1.0)))
    dark = g.mul(g.math('MAXIMUM', dark_f, dark_c), arrive.outputs[0])
    out = g.mul(glow, g.math('SUBTRACT', 1.0, dark))
    for s_ in dst:
        nt.links.new(out, s_)


def lid_halo(h, rig):
    """The sun's warm halation on the vault round the uncovered part of the slot: falls off over
    ~10 m and ~40 m from the slot's edge, measured to the part of the slot the envelope has not yet
    covered, and fades out with the uncovered area (gone at f123)."""
    mat = h['mats']['lid']
    g = graph(mat)
    nt = g.nt
    sx, sy, sz = g.sep(g.texco('Object', h['objects']['slot_frame']))
    ax = g.math('MAXIMUM', g.math('SUBTRACT', g.math('ABSOLUTE', sx), 45.0), 0.0)
    d_slot = g.math('SUBTRACT', g.vmath('LENGTH', g.comb(ax, sy, 0.0)), 22.5)
    rx, ry, _rz = g.sep(g.texco('Object', rig))
    sl = math.radians(CARD_SLANT)
    d_lead = g.mul(g.math('SUBTRACT', rx, g.add(CARD_LEAD, g.mul(ry, math.tan(sl)))), math.cos(sl))
    dd = g.math('MAXIMUM', g.math('MAXIMUM', d_slot, d_lead), 0.0)
    near = g.math('EXPONENT', g.mul(dd, -1.0 / HALO['near']))
    far = g.math('EXPONENT', g.mul(dd, -1.0 / HALO['far']))
    prof = g.add(g.mul(near, HALO['near_w']), g.mul(far, 1.0 - HALO['near_w']))
    level = g.value(1.0, 'S01_Halo')
    key_node_value(level, HALO_KEYS, 'LINEAR')
    plane = g.remap(g.math('ABSOLUTE', sz), 60.0, 40.0)        # only the plastic round the slot itself
    em = g.emission(E.kelvin(HALO['kelvin']), g.mul(prof, level.outputs[0], plane, HALO['strength']))
    mix = g.out.inputs['Surface'].links[0].from_node            # mix(hole, lid, transparent)
    lid_src = mix.inputs[1].links[0].from_socket
    nt.links.new(g.adds(lid_src, em), mix.inputs[1])


def lid_rim(h):
    """The lit cut edge of the plastic all the way round the hole. Beyond the slot plane the
    library's hole flares (0.085 m per m of depth), which swallows its own thin rim glow wherever
    the lid there lies behind the plane: at the lower right of the right end the dark envelope
    then met the dark lid with no bright line between them and read as a bump on the outline.
    Add the same glow on the flared edge (only where the lid is >4 m behind the plane, so it never
    doubles the library's)."""
    mat = h['mats']['lid']
    g = graph(mat)
    nt = g.nt
    sx, sy, sz = g.sep(g.texco('Object', h['objects']['slot_frame']))
    ax = g.math('MAXIMUM', g.math('SUBTRACT', g.math('ABSOLUTE', sx), 45.0), 0.0)
    d = g.math('SUBTRACT', g.vmath('LENGTH', g.comb(ax, sy, 0.0)), 22.5)
    flare = g.add(0.3, g.mul(g.math('MAXIMUM', sz, 0.0), 0.085))
    dv = g.add(g.math('SUBTRACT', d, flare), 0.3)
    lip = g.mul(g.remap(dv, 0.0, 0.25), g.remap(dv, 0.25, 1.1, 1.0, 0.0), g.remap(sz, 4.0, 10.0), g.remap(g.math('ABSOLUTE', sz), 90.0, 75.0))
    em = g.emission(E.kelvin(7000), g.mul(lip, 4.0, nt.nodes['SlotGlow'].outputs[0]))
    mix = g.out.inputs['Surface'].links[0].from_node            # mix(hole, lid, transparent)
    lid_src = mix.inputs[1].links[0].from_socket
    nt.links.new(g.adds(lid_src, em), mix.inputs[1])


# ------------------------------------------------------------------ the world, shot-side

def fix_shaft(h):
    """Fade the shaft's emission out over the last SHAFT_CLIP m before the slot plane (the library's
    prism pokes out through the hole), and warm it toward gold-white (the slot stays white-hot)."""
    mat = h['mats'].get('shaft')
    if mat is None:
        return
    g = graph(mat)
    nt = g.nt
    em = next(n for n in nt.nodes if n.bl_idname == 'ShaderNodeEmission')
    src = em.inputs['Strength'].links[0].from_socket
    _x, _y, sz = g.sep(g.texco('Object', h['objects']['slot_frame']))
    clip = g.remap(sz, -SHAFT_CLIP, 0.0, 1.0, 0.0, smooth=True)
    # eclipsed, the beam's first stretch goes dark too (its stub beside the slot's right end would
    # read as a grey nub on the rim): only a ghost of the shaft stays, well below the slot
    E.key_value(clip.node.inputs[1], ECLIPSE[0], -SHAFT_CLIP, 'BEZIER')
    E.key_value(clip.node.inputs[1], ECLIPSE[1], -SHAFT_CLIP_ECLIPSED, 'BEZIER')
    nt.links.new(g.mul(src, clip), em.inputs['Strength'])
    # feather the beam's edges (its profile (1 - q^2)^1.5 -> ^SHAFT_EDGE): seen grazing from below
    # during the tilt, its side left a hard-edged darker wedge of wall at the right frame edge
    for n in nt.nodes:
        if n.bl_idname == 'ShaderNodeMath' and n.operation == 'POWER' and abs(n.inputs[1].default_value - 1.5) < 1e-6:
            n.inputs[1].default_value = SHAFT_EDGE
    if em.inputs['Color'].is_linked:
        mixc = em.inputs['Color'].links[0].from_node
        if mixc.bl_idname == 'ShaderNodeMix':
            E.G.sock(mixc.inputs, 'Factor_Float').default_value = SHAFT_WARM


def fix_floes(h):
    """Every floe face up (the library's ring quads are wound against its centre fans: under smooth
    shading that put a dark 'sunburst' on every floe), and matte crema rather than wet wax."""
    ob = h['objects'].get('floes')
    if ob is None:
        return
    bm = bmesh.new()
    bm.from_mesh(ob.data)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    flipped = 0
    for f in bm.faces:
        if f.normal.z < 0.0:
            f.normal_flip()
            flipped += 1
    bm.to_mesh(ob.data)
    bm.free()
    ob.data.update()
    up = sum(1 for p in ob.data.polygons if p.normal.z > 0.0)
    print(f'S01 FLOES {up}/{len(ob.data.polygons)} faces up ({flipped} flipped)', flush=True)
    mat = h['mats'].get('foam')
    if mat is None:
        return
    bsdf = next(n for n in mat.node_tree.nodes if n.bl_idname == 'ShaderNodeBsdfPrincipled')
    rl = bsdf.inputs['Roughness'].links
    if rl and rl[0].from_node.bl_idname == 'ShaderNodeMix':
        mx = rl[0].from_node
        E.G.sock(mx.inputs, 'A_Float').default_value = 0.9          # foam
        E.G.sock(mx.inputs, 'B_Float').default_value = 0.45         # espresso in the lace holes and at the ragged edge
    bsdf.inputs['Specular IOR Level'].default_value = 0.22


def sea_near_lens(h):
    """Finer, stronger capillaries within CAPILLARY_NEAR of the lens: they slide toward the camera
    and carry the forward travel in the near field."""
    mat = h['mats'].get('sea')
    if mat is None:
        return
    g = graph(mat)
    nt = g.nt
    bump = next(n for n in nt.nodes if n.bl_idname == 'ShaderNodeBump')
    hsrc = bump.inputs['Height'].links[0].from_socket
    vd = g.node('ShaderNodeCameraData').outputs['View Distance']
    near = g.remap(vd, CAPILLARY_NEAR[0], CAPILLARY_NEAR[1], 0.0, 1.0, smooth=True)
    p = g.texco('Object')
    fine = g.noise(g.mapping(p, scale=(1 / 0.32, 1 / 0.26, 1.0), loc=(3, 7, 0)), 1.0, 2.0, 0.55, dims='2D')
    nt.links.new(g.add(hsrc, g.mul(g.math('SUBTRACT', fine, 0.5), near, 0.6)), bump.inputs['Height'])
    if bump.inputs['Strength'].is_linked:
        ssrc = bump.inputs['Strength'].links[0].from_socket
        nt.links.new(g.mul(ssrc, g.add(1.0, g.mul(near, 0.7))), bump.inputs['Strength'])


def mat_specks():
    m = E.new_mat('S01_Specks')
    g = E.G(m)
    tone = g.attr('tone', 'GEOMETRY', 'Fac')
    col = g.mix(tone, g.cmul(E.CREMA, (0.45, 0.4, 0.35)), g.cmul(E.CREMA, (0.8, 0.75, 0.68)))
    return g.output(g.principled(Base_Color=col, Roughness=0.85, Specular_IOR_Level=0.3))


def build_specks(h, seed=17):
    """Crema lace streaks (along the swell's wind) and loose bubbles on the water 4-30 m ahead of
    the glide: 1-9 cm flat discs riding the swell, the continuous near-field parallax of the glide."""
    rng = np.random.default_rng(seed)
    p0 = Vector(path_point(START) + (0.0,))
    fwd = -BACK
    right = Vector((fwd.y, -fwd.x, 0.0))
    wd = np.array([math.cos(E.FLOE_WIND), math.sin(E.FLOE_WIND)])
    wn = np.array([-wd[1], wd[0]])
    cen, rad = [], []

    def anchor(a_lo=3.5, a_hi=34.0):
        a = rng.uniform(a_lo, a_hi)
        half = 0.95 * a + 2.5
        q = p0 + fwd * a + right * rng.uniform(-half, half)
        return np.array([q.x, q.y])

    for _ in range(SPECK_STREAKS):
        c = anchor()
        L = float(np.clip(rng.lognormal(0.3, 0.55), 0.4, 4.5))
        n = max(3, int(L * rng.uniform(6.0, 14.0)))
        s = rng.uniform(-0.5, 0.5, n) * L
        w = 0.04 + 0.03 * L
        off = rng.normal(0.0, w, n) * (0.4 + 0.6 * np.cos(np.pi * s / L) ** 2)
        cen.append(c + s[:, None] * wd + off[:, None] * wn)
        rad.append(np.clip(rng.lognormal(math.log(0.028), 0.45, n), 0.01, 0.09))
    for _ in range(SPECK_BUBBLES):
        cen.append(anchor()[None, :])
        rad.append(np.clip(rng.lognormal(math.log(0.02), 0.4, 1), 0.008, 0.06))
    P = np.vstack(cen)
    R = np.concatenate(rad)
    a = np.linspace(0.0, 2.0 * np.pi, 6, endpoint=False)
    rot = rng.uniform(0.0, np.pi, len(P))
    squash = rng.uniform(0.6, 1.0, len(P))
    V = np.zeros((len(P), 6, 3))
    V[..., 0] = P[:, 0, None] + R[:, None] * np.cos(a[None, :] + rot[:, None])
    V[..., 1] = P[:, 1, None] + R[:, None] * squash[:, None] * np.sin(a[None, :] + rot[:, None])
    V[..., 2] = 0.03
    F = np.arange(len(P) * 6).reshape(-1, 6)
    ob = E.np_mesh('S01_Specks', V.reshape(-1, 3), [F], coll=C.collection('OFFLINE'), mat=mat_specks(), smooth=False)
    E.set_attr(ob.data, 'tone', np.repeat(rng.uniform(0.0, 1.0, len(P)), 6))
    if 'sea' in h['objects']:
        E._ride_swell(ob, h['objects']['sea'])
    h['objects']['specks'] = ob
    print(f'S01 SPECKS {len(P)} discs', flush=True)
    return ob


def arch_silhouette(h):
    """The arch reads only as a silhouette: near-black albedo, no warm key on it (no gold glints on
    the padlocks or the scree) and its own object index for a little extra haze (arch_haze)."""
    E.apply_fills(h, {'padlock': ARCH_FILL, 'arch_stone': ARCH_FILL})
    # no hooks on the outline: the sprung-open shackles (variants 4, 5) close, the loose broken
    # shackles of the scree rubble (6, 7) go (only S01 sees the arch this far off and backlit)
    tc = bpy.data.collections.get('OFF_PadlockTmpl')
    if tc is not None:
        by_v = {o.get('padlock_variant', -9): o for o in tc.objects if o.get('padlock_variant', -1) >= 0}
        for o in tc.objects:
            v = o.get('padlock_variant', -1)
            if v in (4, 5) and (v - 4) * 2 in by_v:
                o.data = by_v[(v - 4) * 2].data
            elif v == -1:
                o.data = bpy.data.meshes.new('S01_NoShackle')
    O = h['objects']
    objs = [O[k] for k in ('arch_core', 'arch_padlocks', 'scree', 'arch_pines', 'scree_pines', 'scree_rubble') if O.get(k)]
    objs += list(h.get('arch', {}).get('mounds', []))
    tmpl = []
    for o in objs:
        for m in o.modifiers:
            if m.type == 'NODES':
                for key in m.keys():
                    v = m[key]
                    if isinstance(v, bpy.types.Collection):
                        tmpl += list(v.all_objects)
    # the padlocks lying on the scree show their shackles against the paper: S01 keeps only the mounds
    for k in ('scree', 'scree_rubble'):
        if O.get(k) is not None:
            O[k].hide_render = True
    kx = bpy.data.collections.get('OFF_KeyExcluded')
    gx = bpy.data.collections.new('S01_GlintExcluded')          # not in the scene: a light-linking set
    for o in objs + tmpl:
        o.pass_index = ARCH_INDEX
        for c in (kx, gx):
            if c is not None and o.name not in c.objects:
                c.objects.link(o)
    for c in (kx, gx):
        if c is not None:
            for co in c.collection_objects:
                co.light_linking.link_state = 'EXCLUDE'
    if h['lights'].get('glint') is not None:                   # no gold glitter on the arch either
        h['lights']['glint'].light_linking.receiver_collection = gx


def arch_haze(sc):
    """The arch softens into one mass against the cliff: a slight atmospheric blur of its outline
    (ARCH_SOFTEN, through a feathered mask of its object index) and a few per cent of extra aerial
    haze on it (after the mist pass)."""
    nt = sc.node_tree
    rl = next(n for n in nt.nodes if n.bl_idname == 'CompositorNodeRLayers')
    mist = next((n for n in nt.nodes if n.bl_idname == 'CompositorNodeMixRGB' and n.inputs[1].is_linked
                 and n.inputs[1].links[0].from_socket == rl.outputs['Image']), None)
    if mist is None:
        return
    w = sc.render.resolution_x * sc.render.resolution_percentage / 100.0
    hgt = sc.render.resolution_y * sc.render.resolution_percentage / 100.0
    sc.view_layers[0].use_pass_object_index = True
    idm = nt.nodes.new('CompositorNodeIDMask')
    idm.index = ARCH_INDEX
    idm.use_antialiasing = True
    nt.links.new(rl.outputs['IndexOB'], idm.inputs[0])

    def blur(src, px):
        b = nt.nodes.new('CompositorNodeBlur')
        b.filter_type = 'GAUSS'
        if 'Size' in b.inputs:
            b.inputs['Size'].default_value = (px, px)
        else:
            b.size_x = b.size_y = int(round(px))
        nt.links.new(src, b.inputs['Image'])
        return b.outputs['Image']
    feather = blur(idm.outputs[0], ARCH_SOFTEN * w * 2.5)      # reaches just past the outline
    gain = nt.nodes.new('CompositorNodeMath')
    gain.operation = 'MULTIPLY'
    gain.use_clamp = True
    gain.inputs[1].default_value = 2.0
    nt.links.new(feather, gain.inputs[0])
    dst = [lk.to_socket for lk in mist.outputs[0].links]
    soft = nt.nodes.new('CompositorNodeMixRGB')
    nt.links.new(gain.outputs[0], soft.inputs[0])
    nt.links.new(mist.outputs[0], soft.inputs[1])
    nt.links.new(blur(mist.outputs[0], ARCH_SOFTEN * w), soft.inputs[2])
    amt = nt.nodes.new('CompositorNodeMath')
    amt.operation = 'MULTIPLY'
    amt.inputs[1].default_value = ARCH_HAZE
    nt.links.new(gain.outputs[0], amt.inputs[0])
    mix = nt.nodes.new('CompositorNodeMixRGB')
    mix.inputs[2].default_value = tuple(mist.inputs[2].default_value)
    nt.links.new(amt.outputs[0], mix.inputs[0])
    nt.links.new(soft.outputs[0], mix.inputs[1])
    for d in dst:
        nt.links.new(mix.outputs[0], d)


def key_shutter(sc):
    """Motion blur shutter: the film's 0.5, a little shorter through the quickest part of the tilt."""
    for f, v in SHUTTER:
        sc.render.motion_blur_shutter = v
        sc.render.keyframe_insert('motion_blur_shutter', frame=f)


def key_seed(sc):
    """Fixed seed where the camera is still, a fresh seed per frame through the tilt."""
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
    arch_silhouette(h)
    fix_shaft(h)
    fix_floes(h)
    sea_near_lens(h)
    build_specks(h)
    loc, rot, lens, _sh = cam_state(START)
    cam = E.camera_offline(lens, loc, loc + Vector((0, 1, 0)))
    key_camera(cam)
    E.set_shaft_camera(h, True)
    E.apply_look('day')
    arch_haze(sc)
    key_look(sc)
    key_fade(sc)
    key_seed(sc)
    key_shutter(sc)
    print(f'S01 BUILD {time.time() - t0:.1f}s end lens {END_LENS:.2f} mm, end pitch {END_PITCH:.2f} deg, '
          f'end yaw {END_YAW:.2f} deg, glide {remaining(START):.2f} m, eclipse travel {contact_travel():.1f} m',
          flush=True)
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
