"""E2_LONG_ROOM: the 34 m boardroom around the 30 m walnut table (and E3 inserts' set).

    import env_room as R
    room = R.build(placeholder=True, seat_yaw_deg=R.SHOT_SEAT_YAW['s03'])
    room.render_budget(kind='wide')        # opt in: the room's measured render settings
    room.terminals['kevin'].speak(353, 376)
    pad = room.props['kevin'][0]
    P.slide(pad, 377, 424, R.prop_home('kevin'), R.stop_for('padlock', obj=pad), settle=0.0)
    room.key_visible(pad, 433, False)      # S05 takes it off the walnut (the shot's hand copy)
    room.shutdown_wave(1001)               # S11 order, a screen every 5 frames
    room.set_state(1053, 'dark')
    room.tune_scanlines(cam)               # moire-safe CRT scanlines for this lens
    room.front_bokeh(cam)                  # S02 end / S05 / S13: colour discs behind him
    room.compositor()                      # house look: glare, mist, vignette

Coordinates are fixed (shots depend on them) and exported in ROOM / SEATS:
metres, Z up, floor z=0, the table runs from its foot (y=-30) to its head edge
(y=0), and Synergy stands at SYNERGY_POS facing -Y (his right is -X).
One 6500K sun lays a hard 0.75 m slab down the table spine through a rounded-slot
skylight (a second sun on the same heading, light-linked to the walnut, keeps the slab
2.5:1 over the CRT pools without over-lighting anything else); each CRT pools its
colour on the glossy walnut through its own area light, and a card per live screen,
light-linked to the walnut alone, streaks that colour down the coat.
No volumetrics: depth haze comes from the compositor mist pass.

Cords: each terminal's yellow coiled cord drops from the CRT, runs under the table's
overhang to its routed groove 2 m down-table of the seat, comes up the edge face and lies
flush in the groove (a long diagonal into the brass channel, down-table of every prop
home), then runs in its own lane to the hub. Slides pass over the grooves. The S03 wide
lays them proud on the walnut instead (SHOT_CORDS, Room.set_cord_mode): a per-shot cheat
like the chair swivel, so nine yellow diagonals read at 25 m where nothing slides.

Per-shot chair swivel: terminals face the host by default (seat_yaw_deg); shots
that look up-table from the foot swivel them toward the camera
(build(seat_yaw_deg=...) or room.set_seat_yaw(deg); SHOT_SEAT_YAW has the values).

Insert light kits (room.insert_lights('jack' | 'padlock' | 'zero' | 'lid' | 'sip')) each
live in their own collection; room.use_kits('jack') shows one kit and hides the others.

State hand-overs between the room and the shots are listed in demo_timeline's docstring
(the padlock leaves the walnut at f433, the droid's hand-off at f712 and reverse-out from
f737, the binder hidden from f729, the droid's pinlight out at f1049).
"""

import math

import bmesh
import bpy
from mathutils import Matrix, Vector

import common as C
import props as P

# ================================================================== fixed coordinates

ROOM = dict(
    interior_x=(-4.5, 4.5), interior_y=(-32.5, 1.5), interior_z=(0.0, 6.0),
    floor_z=0.0,
    table_top_z=0.75, table_bottom_z=0.67, table_y=(-30.0, 0.0), table_half_w=0.8,
    plinth_half_w=0.40, plinth_y=(-29.25, -0.75), plinth_top_z=0.60,
    channel_width=0.13, channel_depth=0.0115, channel_y=(-29.40, -0.40),   # cords lie flush, 0.5 mm under the lip
    synergy_pos=(0.0, 0.40, 0.0),
    hub_pos=(0.0, -0.30, 0.75),
    socket_pos=(0.22, 0.0, 0.70),          # set into the head edge, facing +Y
    printer_chair=(0.0, -31.2, 0.0),        # faces +Y (toward the host)
    printer_stack=(-0.55, -30.22, 0.0),     # on the floor between the printer's chair and the table foot, camera-left
    chair_x=1.25,
    seat_top_z=0.55,                        # the cushion's rim; its crown is 10 mm higher
    seat_rest_z=0.5585,                     # where a CRT base / the printer rests on the crowned cushion
    seat_yaw_deg=22.0,                      # colleagues turned toward the host (0 = square to the axis)
    seat_yaw_wide_deg=-40.0,                # chair-swivel cheat: screens toward the foot camera (S03)
    droid_lane_x=1.9,
    droid_start=(1.9, -29.3),               # waiting in its lane abreast of the table's foot, facing up-room
    droid_start_heading=0.0,                # degrees, props.Droid convention (0 faces +Y, -90 faces +X)
    droid_bay=(1.15, -3.0),
    droid_trail=0.35,                       # the trolley runs this far outboard of the droid's track (offset hitch)
    # S07 hand-off: the droid comes up its lane, round behind the head of the table and back
    # down beside his left hip, facing the foot; the trolley's binder then sits at
    # droid_handoff_binder (centre, top at ~0.77 m), 0.4 m from his left shoulder in plan
    droid_handoff=(1.02, -0.48),            # the droid's own stop (facing -Y, heading 180)
    droid_turn_y=0.15,                      # centre of its turn behind the head edge (clear of the head wall)
    droid_handoff_binder=(0.67, 0.34),      # binder centre at f712 (demo_timeline; measured), top at 0.72 m
    droid_park_y=-29.0,                     # after the hand-off it backs all the way down its lane to the foot
    skylight_len=28.4, skylight_w=0.75, skylight_cy=-13.6, skylight_depth=0.9,   # slot y -27.8 .. +0.6
    mullion_pitch=2.6,                      # 20 mm glazing bars, barely darker than the glass
    sun_tilt_deg=10.0,                      # light travels toward +Y: the slab reaches over the host
    prop_x=0.50,                            # problem props sit this far off the spine
    # Synergy's left index fingertip resting on the walnut: the reach_L contract (synergy.py
    # REACH_L_TIP) puts the END of the index tip, its down-table surface, here. stop_for()
    # measures the sliding object itself and can take a measured tip (measure_tip) instead.
    fingertip_L=(0.29, -0.09, 0.755),
    stop_L=(0.29, -0.108),                  # the hero padlock's stop against the contract tip (stop_for('padlock'))
    streak_x=0.52, streak_z=0.95,           # walnut-streak cards: over the table, inboard of each terminal (head end)
)
SYNERGY_POS = ROOM['synergy_pos']
HUB_POS = ROOM['hub_pos']
SOCKET_POS = ROOM['socket_pos']
TABLE_TOP = ROOM['table_top_z']
FINGER_R = 0.0          # fingertip_L is the tip's surface (kept for callers that offset a centre)
FINGER_W = 0.010        # half-width of the fingertip: the band of the object that meets it

# side: -1 = his right (-X, camera-left from the foot), +1 = his left (+X)
SEATS = {
    'synthia': (-1, -3.0), 'keys': (-1, -8.0), 'kevin': (-1, -13.0), 'operations': (-1, -18.0), 'pat': (-1, -23.0),
    'droid_bay': (1, -3.0), 'arjun': (1, -8.0), 'strategy': (1, -13.0), 'people': (1, -18.0), 'linda': (1, -23.0),
}
TERMINALS = ['synthia', 'keys', 'kevin', 'operations', 'pat', 'arjun', 'strategy', 'people', 'linda']
# lanes inside the brass channel (x offset); farthest terminals run nearest the centre line
LANES = {'pat': -0.0060, 'operations': -0.0180, 'kevin': -0.0300, 'keys': -0.0420, 'synthia': -0.0540,
         'linda': 0.0060, 'people': 0.0180, 'strategy': 0.0300, 'arjun': 0.0420}
# what waits on the walnut in front of each colleague
PROPS = {
    'synthia': ['envelope'], 'keys': ['envelope'], 'kevin': ['padlock'], 'operations': ['envelope'],
    'pat': ['envelope'], 'arjun': ['tabs'], 'strategy': ['tabs', 'tabs'], 'people': ['envelope'],
    'linda': ['glass_zero'],
}
SHUTDOWN_ORDER = ['synthia', 'keys', 'arjun', 'kevin', 'strategy', 'operations', 'people', 'linda']

# Chair swivel per shot (degrees, + = screens toward the host, - = toward the foot). A
# standard cheat: each shot turns the colleagues to its own camera.
SHOT_SEAT_YAW = {'s02': 22.0, 's03': -40.0, 's04': 45.0, 's05': 22.0, 's07': 45.0, 's09': 22.0, 's10': 22.0,
                 's11': 45.0, 's13': 22.0, 's14': 22.0}
# Cord lie per shot (Room.set_cord_mode): flush in their grooves wherever anything slides or
# the lens is near the walnut; proud on the walnut in the S03 wide, where nothing slides and a
# flush cord is invisible at 15-25 m (a groove at 7 deg grazing shows only its top 2 mm)
SHOT_CORDS = {'s03': 'proud'}

# sun_table: a second sun on the same heading, light-linked to the walnut only: the slab on
# the dark coat reads 2.5:1 over the CRT pools without over-lighting him, the props or paper.
LIGHT = dict(sun=6.5, sun_angle=0.35, sun_table=6.0, diffuser=1.9, fill=0.06, crt=6.5, wash=0.085, pat=40.0,
             foot=1.3, streak=0.6, streak_len=5.5, streak_w=0.25, streak_head=0.5, wash_span=14.0, wash_cy=-15.0)

CORD_RC = 0.0042 + 0.0013                  # coil outer radius
# Each colleague's cord crosses the walnut in its own routed groove: a short stub square to
# the table's long edge `out_dy` down-table of the seat, then a long diagonal to the channel
# wall `in_dy` up-table of it (2 m along the table, so in the foot wide each reads as a line
# converging on the host, not a rung), lying flush, so slides pass over it; down-table of
# every prop home. Facing pairs make one long chevron toward the host.
# The channel's brass lip is inlaid flush (`lip` wide); a `breadboard` closes each end.
GROOVE = dict(width=0.0135, out_dy=-2.0, in_dy=0.05, stub=0.05, lip=0.0050, breadboard=0.075)
MASTER_RC = CORD_RC + 0.0005               # master cord centre height over the walnut (0.5 mm clear: NURBS undershoot)
# Half-depth of each problem object along its slide in its HOME orientation (PROPS): the
# padlock turned 4 deg, broad face down-table; an envelope long axis along the table (turned
# 4 deg), 0.110 + 0.055 sin 4; a tab stack turned ~87 deg, its 104 mm cards along the table
# plus the stagger; the glass zero's outer radius; the binder's half depth. These are only the
# fallback for stop_for(kind) without an object: anything that spins or turns on its slide
# (the frisbee envelope, a turned tab stack) must pass obj= and its END yaw (yaw=rz0+spin).
STOP_HALF = {'padlock': 0.0160, 'envelope': 0.1137, 'tabs': 0.0560, 'glass_zero': 0.0625, 'binder': 0.15}

# Room-level render settings per kind of framing (Room.render_budget). 'final' clamps the
# samples only when no explicit --samples override was given; 'hero' is never clamped.
BUDGET = {
    # (max_bounces only caps transmission chains: three stacked acrylic tabs or the glass zero
    # need 6-8 interfaces, diffuse and glossy are capped on their own)
    'wide': dict(max_bounces=8, diffuse=2, glossy=2, transmission=8, transparent=6, volume=0,
                 threshold=0.06, min_samples=6, final_spp=12),
    # macro inserts are held beats: more samples, a tight adaptive threshold (no denoiser boil)
    'macro': dict(max_bounces=8, diffuse=1, glossy=2, transmission=8, transparent=4, volume=0,
                  threshold=0.03, min_samples=8, final_spp=16),
}
# locked-off framings (static camera): a fixed sampling seed, so static content renders the
# same noise every frame and the denoiser cannot crawl
LOCKED_OFF = ('s05', 's09', 's10', 's11', 's13')


def seat_xy(name):
    side, y = SEATS[name]
    return side * ROOM['chair_x'], y


def seat_rot(name, yaw_deg=None):
    """Chair/terminal heading (radians about Z) for a seat at a given swivel."""
    side, _ = SEATS[name]
    yaw = math.radians(ROOM['seat_yaw_deg'] if yaw_deg is None else yaw_deg)
    return (-math.pi / 2 + yaw) if side < 0 else (math.pi / 2 - yaw)


def prop_home(name, index=0):
    """Resting place of a colleague's problem object on the walnut (x, y)."""
    side, y = SEATS[name]
    if name == 'kevin':
        return side * ROOM['prop_x'], y + 1.40          # hero padlock: 1.5 m in front of Kevin's screen
    return side * ROOM['prop_x'], y + 0.60 - 0.42 * index


def _world_points(obj):
    """Evaluated world-space vertices of an object and all its mesh descendants."""
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    stack = [obj]
    pts = []
    while stack:
        o = stack.pop()
        stack.extend(o.children)
        if o.type != 'MESH':
            continue
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        mw = ev.matrix_world
        pts.extend(mw @ v.co for v in me.vertices)
        ev.to_mesh_clear()
    return pts


def measure_tip(objs, x_span=None, z_band=(0.0, 10.0)):
    """The down-table-most (-Y) surface point of a set of meshes (e.g. the rig's left
    finger tips, rig.parts_on_bones(['index_3_L', 'middle_3_L', 'ring_3_L'])) at the current
    frame, optionally only within x_span=(x0, x1) and a z band. Pass it to stop_for(tip=...)."""
    best = None
    for o in objs:
        for p in _world_points(o):
            if x_span and not (x_span[0] <= p.x <= x_span[1]):
                continue
            if not (z_band[0] <= p.z <= z_band[1]):
                continue
            if best is None or p.y < best.y:
                best = p.copy()
    return tuple(best) if best is not None else None


def _bvh_world(objs, offset=Vector((0.0, 0.0, 0.0))):
    """BVH tree (and its world-space vertices) of the evaluated meshes of objs and all their
    mesh descendants, translated by offset."""
    from mathutils.bvhtree import BVHTree
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    verts, polys = [], []
    stack = list(objs)
    while stack:
        o = stack.pop()
        stack.extend(o.children)
        if o.type != 'MESH':
            continue
        ev = o.evaluated_get(dg)
        me = ev.to_mesh()
        mw = ev.matrix_world
        base = len(verts)
        verts.extend(mw @ v.co + offset for v in me.vertices)
        polys.extend([base + i for i in p.vertices] for p in me.polygons)
        ev.to_mesh_clear()
    return BVHTree.FromPolygons(verts, polys), verts


def _swept_contact(obj, hand, start2, d2):
    """Distance the object can travel from start2 along d2 before it first touches a hand
    surface (vertices of each cast against the other's surface), within the object's height."""
    origin = obj.matrix_world.translation
    off = Vector((start2.x - origin.x, start2.y - origin.y, 0.0))
    t_obj, v_obj = _bvh_world([obj], off)
    t_hand, v_hand = _bvh_world(hand)
    zl = min(v.z for v in v_obj) - 0.001
    zh = max(v.z for v in v_obj) + 0.001
    d3 = Vector((d2.x, d2.y, 0.0)).normalized()
    best = None
    for q in v_hand:
        if zl <= q.z <= zh:
            hit = t_obj.ray_cast(q, -d3, 40.0)
            if hit[0] is not None and (best is None or hit[3] < best):
                best = hit[3]
    for p in v_obj:
        hit = t_hand.ray_cast(p, d3, 40.0)
        if hit[0] is not None and (best is None or hit[3] < best):
            best = hit[3]
    return best


def stop_for(kind='padlock', obj=None, tip=None, start=None, gap=None, hand=None, yaw=None):
    """(x, y) where an object's centre stops against Synergy's left fingertip.

    hand: the rig's left-hand meshes posed at the arrival frame (e.g.
    rig.parts_on_bones(['hand_L', 'index_1_L', ... 'thumb_2_L'])): the exact stop. The
    object (`obj`, required) is swept from `start` toward the tip and stops `gap` before its
    first contact with any hand vertex inside its own height band: zero overlap, a 1-2 mm
    gap where it meets the finger.
    Without `hand`: `tip` (a measured surface point, measure_tip) or the contract
    fingertip_L, and the object's full evaluated extent along the slide (`obj`) or
    STOP_HALF[kind]: its leading face ends `gap` short of the tip (conservative: a corner
    of a turned object leads). gap defaults to 1.5 mm with a hand or a measured tip, 3 mm
    against the contract point.

    yaw: the object's heading (radians about Z) WHEN IT ARRIVES. An object that spins or
    turns on its slide (slide(..., spin_deg=...)) must pass it (yaw = its start
    rotation_euler.z + radians(spin_deg)): its extent is measured turned to that heading,
    so the arriving edge, not the starting one, meets the finger. Slides that stop against
    the finger should use settle=0 (slide's settle overshoots the mark by `settle`)."""
    if gap is None:              # the contract tip ignores the finger's rounded cap: keep clear of it
        gap = 0.0015 if (hand or tip is not None) else 0.003
    fx, fy = (ROOM['fingertip_L'][0], ROOM['fingertip_L'][1] - FINGER_R) if tip is None else (tip[0], tip[1])
    if obj is None:
        return fx, fy - gap - STOP_HALF.get(kind, 0.02)
    pts = _world_points(obj)
    origin = obj.matrix_world.translation
    o2 = Vector((origin.x, origin.y))
    rel = [Vector((p.x, p.y)) - o2 for p in pts]
    if yaw is not None:
        da = yaw - obj.matrix_world.to_euler('XYZ').z
        ca, sa = math.cos(da), math.sin(da)
        rel = [Vector((ca * r.x - sa * r.y, sa * r.x + ca * r.y)) for r in rel]
    if hand and yaw is not None:
        raise ValueError('stop_for: pass hand= or yaw=, not both (pose the object at its end yaw first)')
    st = Vector(start[:2]) if start is not None else o2
    t2 = Vector((fx, fy))
    d = t2 - st
    d = d.normalized() if d.length > 1e-6 else Vector((0.0, 1.0))
    if hand:
        best = _swept_contact(obj, hand, st, d)
        if best is not None:
            stop = st + d * (best - gap)
            return stop.x, stop.y
    lead = 0.0
    stop = t2
    for _ in range(6):
        d = stop - st
        d = d.normalized() if d.length > 1e-6 else Vector((0.0, 1.0))
        lead = max(r.dot(d) for r in rel)
        stop = t2 - d * (lead + gap)
    # and never past the tip's line: the object's most up-table point stays >= 1.5 mm short
    # of the tip (a turned corner can lead the slide direction's extent)
    ymax = stop.y + max(r.y for r in rel)
    lim = fy - max(0.0015, gap * 0.5)
    if ymax > lim and d.y > 1e-3:
        stop = stop - d * ((ymax - lim) / d.y)
    return stop.x, stop.y


# ================================================================== Room handle


def _key_value(owner, path, frame, value, interp):
    """Set and key owner.path at frame, styling ONLY that key."""
    setattr(owner, path, value)
    owner.keyframe_insert(path, frame=frame)
    idb = owner.id_data
    dp = owner.path_from_id(path) if owner is not idb else path
    ad = idb.animation_data
    if ad and ad.action:
        for fc in C.fcurves(ad.action):
            if fc.data_path == dp:
                for kp in fc.keyframe_points:
                    if abs(kp.co.x - frame) < 1e-3:
                        kp.interpolation = interp


class Room:
    """Everything the shots animate. Attributes:

    terminals{name: props.Terminal}   chairs{name: instance}    cords{name: curve obj}
    props{name: [objects]}            printer (props.Printer)   droid (props.Droid)
    hub (props.Hub)  socket  jack (props.Jack)  master (props.MasterCord)
    sun  diffuser  fills[]  walls{'head','foot','left','right'}  table  placeholder (or None)
    streaks{name: card}  seat_yaw (degrees)  insert{} (lights/dust added by insert_lights)
    """

    def __init__(self):
        self.terminals = {}
        self.chairs = {}
        self.cords = {}
        self.props = {}
        self.walls = {}
        self.fills = []
        self.insert = {}
        self.kits = {}
        self.streaks = {}
        self.placeholder = None
        self.mullions = None
        self.seat_yaw = ROOM['seat_yaw_deg']
        self.cord_mode = 'flush'
        self._budget_base = None

    # --- room-wide lighting state
    def set_state(self, frame, state, ramp=0):
        """'lit' (meeting on) or 'dark' (after the unplug), switched at `frame` (or faded
        over `ramp` frames from `frame`). Keys the ambient fills and the skylight diffuser;
        the slab (sun) always stays. Terminals keep their own keys.

        Every change keys its own hold: the previous value is keyed at frame-1 (or at the
        ramp start) and only the keys this call inserts are styled, so an earlier fade is
        never turned into a hard switch by a later call."""
        lit = state == 'lit'
        prev = getattr(self, '_state', None)
        d = LIGHT['diffuser']
        targets = [(l.data, 'energy', e if lit else e * 0.04, e if prev == 'lit' else e * 0.04) for l, e in self.fills]
        targets.append((self.diffuser_strength, 'default_value', d if lit else d * 0.55,
                        d if prev == 'lit' else d * 0.55))
        for owner, path, new, old in targets:
            if prev is None:
                _key_value(owner, path, frame, new, 'CONSTANT')
            elif ramp > 0:
                _key_value(owner, path, frame, old, 'LINEAR')
                _key_value(owner, path, frame + ramp, new, 'CONSTANT')
            else:
                _key_value(owner, path, frame - 1, old, 'CONSTANT')
                _key_value(owner, path, frame, new, 'CONSTANT')
        self._state = state

    def shutdown_wave(self, f0, order=SHUTDOWN_ORDER, step=5):
        """S11: terminals die one by one, near to far, a screen every `step` frames."""
        for i, nm in enumerate(order):
            self.terminals[nm].shutdown(f0 + i * step)

    def sun_drift(self, f0, f1, dx=0.20):
        """S13: the room tilts; the slab slides `dx` metres across the walnut."""
        h = TABLE_TOP
        ang = math.atan2(dx, ROOM['interior_z'][1] - h)
        for s in (self.sun, getattr(self, 'sun_table', None)):
            if s is None:
                continue
            s.rotation_euler = self.sun_rot
            s.keyframe_insert('rotation_euler', frame=f0)
            s.rotation_euler = (self.sun_rot[0], -ang, self.sun_rot[2])
            s.keyframe_insert('rotation_euler', frame=f1)

    def hide_from_camera(self, *walls):
        """Make walls invisible to camera rays (still reflected and still shading),
        for cameras placed beyond the room's interior (S03 starts behind the foot wall,
        S11 sits behind the head wall)."""
        for w in self.walls.values():
            for o in w:
                o.visible_camera = True
        for name in walls:
            for o in self.walls[name]:
                o.visible_camera = False

    def hide_far_room(self, hide=True):
        """Macro inserts: walls and ceiling off for camera rays (they only ever fill the
        defocused background; their reflections and the light they bounce stay)."""
        for w in self.walls.values():
            for o in w:
                o.visible_camera = not hide
        for o in (self.ceiling, self.well):
            o.visible_camera = not hide

    def head_mirror(self, on=True):
        """S02/S05 option: the acoustic panels behind the host become smoked black glass, so
        the nine screens and the slab down the table mirror behind him as soft colour discs
        in a long-lens close-up. Off restores the fabric."""
        mat = P.smoked_glass()
        for o in self.walls['head']:
            if o.type != 'MESH' or not o.name.startswith('panel_'):
                continue
            slot = o.material_slots[0]
            if on:
                slot.link = 'OBJECT'
                slot.material = mat
            else:
                slot.link = 'DATA'
        self.mirror = on

    def front_bokeh(self, cam=None, frame=None, n=6, behind=(6.0, 12.0), disc_px=(40.0, 90.0), seed=5,
                    strength=0.6, region=None):
        """Colour bokeh behind a hero close-up (S02's end, S05, S13): camera-only emissive
        discs `behind` metres beyond him along this camera's rays, in the upper third of the
        frame on both sides of his head, sized so each reads `disc_px` px wide at 1600 px
        (geometry + this lens's defocus). One disc per colleague (cobalt, acid yellow, pink and
        sky first), each driven by its terminal's screen state, so they flare with it and die
        in the S11 wave; Pat's grey disc stays dark until Pat powers on (S13's faint distant
        disc). The head wall is hidden from camera rays (it still bounces light) so the discs
        sit in the void behind him. Lights nothing, mirrors in nothing. Rebuilt per call (for
        the camera at `frame`, default the current one). region = (x0, x1, y0, y1) in 0..1
        image space overrides the default band. Returns the discs."""
        sc = bpy.context.scene
        cam = cam or sc.camera
        if frame is not None:
            sc.frame_set(frame)
        bpy.context.view_layer.update()
        for o in getattr(self, 'bokeh', []):
            me = o.data
            bpy.data.objects.remove(o)
            if me.users == 0:
                bpy.data.meshes.remove(me)
        for o in self.walls['head']:
            o.visible_camera = False
        coll = C.collection('LR_front_bokeh', C.collection('LongRoom'))
        mw = cam.matrix_world.copy()
        cd = cam.data
        res_x = sc.render.resolution_x * sc.render.resolution_percentage / 100.0
        res_y = sc.render.resolution_y * sc.render.resolution_percentage / 100.0
        sw = cd.sensor_width
        sh = sw * res_y / res_x
        lens = cd.lens
        f_px = lens / sw * res_x
        loc = mw.translation
        rot = mw.to_3x3()
        head = Vector(SYNERGY_POS) + Vector((0.0, 0.0, 1.60))
        q = rot.inverted() @ (head - loc)
        hx = 0.5 + (-q.x / q.z) * lens / sw - cd.shift_x if q.z < 0 else 0.5
        hw_img = 0.30 / max(-q.z, 0.1) * lens / sw            # his head's half width (with margin) in frame
        d_him = (head - loc).length
        rng = __import__('random').Random(seed)
        order = ['keys', 'strategy', 'people', 'kevin', 'operations', 'arjun', 'synthia', 'linda'][:n] + ['pat']
        x0, x1, y0, y1 = region or (0.04, 0.96, 0.66, 0.95)
        slots = []
        g = max(0.12, hw_img)
        if hx - g - x0 < 0.08 and x1 - hx - g < 0.08 and region is None:
            g, y0 = 0.10, 0.40                                  # a tight close-up: beside the head, lower
        left = [a for a in (x0 + (hx - g - 0.01 - x0) * k / 3 for k in range(4)) if a < hx - g]
        right = [a for a in (hx + g + 0.01 + (x1 - hx - g - 0.01) * k / 3 for k in range(4)) if a > hx + g]
        cand = [(x, y0 + (y1 - y0) * rng.random()) for x in left + right]
        rng.shuffle(cand)
        for k, nm in enumerate(order):
            x, y = cand[k % len(cand)] if cand else (0.2 + 0.1 * k, 0.8)
            slots.append((nm, x + rng.uniform(-0.03, 0.03), y))
        fs = cd.dof.aperture_fstop if cd.dof.use_dof else 0.0
        F = cd.dof.focus_distance
        if cd.dof.use_dof and cd.dof.focus_object is not None:
            F = (cd.dof.focus_object.matrix_world.translation - loc).length
        mat = _bokeh_mat()
        discs = []
        for nm, x, y in slots:
            t = self.terminals[nm]
            dirc = Vector(((x - 0.5 + cd.shift_x) * sw / lens, (y - 0.5) * sh / lens + cd.shift_y * sw / lens, -1.0))
            dw = (rot @ dirc).normalized()
            D = d_him + rng.uniform(*behind)
            p = loc + dw * D
            target = rng.uniform(*disc_px) * res_x / 1600.0
            blur = 0.0
            if fs > 0 and F > 0:
                fl = lens / 1000.0
                blur = (fl * fl / (fs * max(F - fl, 1e-3))) * abs(D - F) / D / (sw / 1000.0) * res_x
            g_px = max(target - 0.8 * blur, 0.35 * target)
            diam = g_px / f_px * D
            bm = bmesh.new()
            uvl = bm.loops.layers.uv.new('UVMap')
            ring = [bm.verts.new((0.5 * diam * math.cos(2 * math.pi * i / 32), 0.5 * diam * math.sin(2 * math.pi * i / 32),
                                  0.0)) for i in range(32)]
            c = bm.verts.new((0.0, 0.0, 0.0))
            for i in range(32):
                f = bm.faces.new((c, ring[i], ring[(i + 1) % 32]))
                for lp in f.loops:
                    lp[uvl].uv = (lp.vert.co.x / diam + 0.5, lp.vert.co.y / diam + 0.5)
            o = P.to_object(bm, f'bokeh_{nm}', [mat], coll, smooth=None, recalc=False)
            o.location = p
            o.rotation_euler = (-dw).to_track_quat('Z', 'Y').to_euler()
            for flag in ('visible_diffuse', 'visible_glossy', 'visible_shadow', 'visible_transmission',
                         'visible_volume_scatter'):
                setattr(o, flag, False)
            scr = t.screen
            hue = list(scr['crt_hue'])
            mx = max(max(hue), 1e-4)
            o['bokeh_rgb'] = [h / mx for h in hue]
            o['bokeh_k'] = 0.0
            lv = float(scr['crt_level']) * (2.5 if nm == 'pat' else 1.0)
            v = [('on', scr, '["crt_on"]'), ('gain', scr, '["crt_gain"]'), ('sx', scr, '["crt_sx"]'),
                 ('sy', scr, '["crt_sy"]'), ('flare', scr, '["crt_flare"]')]
            P.add_driver(o, '["bokeh_k"]', f'{strength * lv * mx:.4f}*on*gain*flare*(0.05+0.95*sx*sy)', v)
            o['bokeh_terminal'] = nm
            discs.append(o)
        self.bokeh = discs
        return discs

    def set_cord_mode(self, mode):
        """'flush' (default: every cord lies in its groove, crest under the walnut, so the
        slides pass over it) or 'proud' (the S03 wide only: each cord lies ON the walnut over
        its groove, so the nine diagonals read at 25 m; a per-shot cheat like the chair
        swivel, for shots in which nothing slides). Rebuilds the cords."""
        if mode not in ('flush', 'proud'):
            raise ValueError(mode)
        if mode == getattr(self, 'cord_mode', 'flush'):
            return
        self.cord_mode = mode
        self.set_seat_yaw(self.seat_yaw)

    def set_seat_yaw(self, yaw_deg):
        """Swivel every colleague's chair (and terminal, glow and cord with it) to
        `yaw_deg` (+ toward the host, - toward the foot). Rebuilds the cords, then
        re-evaluates the depsgraph so the next render sees the new geometry."""
        self.seat_yaw = yaw_deg
        for name in TERMINALS:
            rot = seat_rot(name, yaw_deg)
            ch = self.chairs.get(name)
            if ch is not None:
                ch.rotation_euler = (0, 0, rot)
            t = self.terminals[name]
            mw = _terminal_matrix(name, yaw_deg)
            t.root.location = mw.translation
            t.root.rotation_euler = (0, 0, rot)
        bpy.context.view_layer.update()
        if self.cords:
            coll = next(iter(self.cords.values())).users_collection[0]
            for name, cu in list(self.cords.items()):
                data = cu.data
                bpy.data.objects.remove(cu)
                bpy.data.curves.remove(data)
            self.cords = {}
            _cords(self, coll)
        bpy.context.view_layer.update()
        dg = bpy.context.evaluated_depsgraph_get()
        dg.update()
        for cu in self.cords.values():
            cu.evaluated_get(dg)

    def tune_scanlines(self, cam=None, res_x=None):
        """Moire-safe CRT scanlines (and the coarse raster ripple) for this camera's lens
        and the render width."""
        sc = bpy.context.scene
        cam = cam or sc.camera
        res_x = res_x or sc.render.resolution_x * sc.render.resolution_percentage / 100.0
        return P.set_scanlines(cam.data.lens, res_x, cam.data.sensor_width)

    # --- visibility of animated props (posted objects leave the table)
    def key_visible(self, obj, frame, visible):
        """Key `obj` and all its descendants (and any insert card riding on it) visible or
        hidden from `frame` (constant). The schedule is stored on the object, so insert
        cards added later inherit it."""
        sched = list(obj.get('vis_keys', []))
        sched.append([float(frame), 1.0 if visible else 0.0])
        obj['vis_keys'] = sched
        stack = [obj]
        while stack:
            o = stack.pop()
            stack.extend(o.children)
            _key_hidden(o, frame, not visible)

    # --- insert light kits
    def insert_lights(self, kind='jack', dust=True, cache_dir=None, target=None, card_dir=None):
        """Insert light kits lit inside the room, each in its own collection (use_kits shows
        one and hides the rest). Building a kit twice returns the existing one.

        'jack' (S10): a warm walnut bounce card below and in front of the socket (diffuse
        only), a soft warm field the gold mirrors on its lower flank (glossy only, light-linked
        to the jack and socket), a cool 6500K kicker raking along the knurl (glossy-visible, low), a small rim,
        a long soft warm card above and behind the lens that only glossy rays see (it lays
        one continuous gold streak down the barrel), and ~120 dust motes drifting in the
        slab above the walnut and in front of the host.
        'padlock' (S04/S09): a soft warm card that rides with `target` (default Kevin's
        padlock) 0.55 m out along `card_dir` (default: the camera side, away from Kevin's
        screen): the brass face reads instead of silhouetting. It inherits the padlock's
        visibility keys (gone when the padlock is posted).
        'zero' (S07 / macro): two thin strip cards that ride with `target` (default Linda's
        zero), glossy-visible and linked to the glass only: crisp rim highlights.
        'lid' (S02 opening): a low raking key across the lid and a soft fill, linked to the
        cup (`target` = a props.Cup, default the stand-in's).
        'sip' (S13): a small cool-neutral card at cup height from camera-left (diffuse only)
        and a thin rim card for the lid, so the white cup holds a neutral grey in the dark;
        `target` = the cup meshes (default: every '*_cup_cup' / '*_cup_lid' in the scene).
        The padlock card, the jack's gold-streak card and the sip kit are light-linked to
        their hero objects only."""
        parent = C.collection('LR_insert', C.collection('LongRoom'))
        coll = C.collection(f'LR_ins_{kind}', parent)
        self.kits[kind] = coll
        out = {}
        if kind == 'jack':
            if 'bounce' in self.insert:
                return {k: self.insert[k] for k in ('bounce', 'kicker', 'rim', 'streak', 'gold_field', 'dust')
                        if k in self.insert}
            s = Vector(ROOM['socket_pos']) + Vector((0.0, P.SOCKET_FACE, 0.0))
            b = C.area_light('ins_bounce', tuple(s + Vector((0.03, 0.16, -0.10))), tuple(s + Vector((0.0, 0.02, 0.0))),
                             0.30, 0.18, 0.10, color=(1.0, 0.76, 0.52), coll=coll)
            gf = C.area_light('ins_gold_field', tuple(s + Vector((0.05, 0.17, -0.08))), tuple(s + Vector((0.0, 0.02, 0.0))),
                              0.55, 0.40, 0.22, color=(1.0, 0.82, 0.58), coll=coll)
            k = C.area_light('ins_kicker', tuple(s + Vector((-0.10, 0.05, 0.22))), tuple(s + Vector((0.0, 0.02, 0.0))),
                             0.10, 0.035, 0.12, color=(0.86, 0.91, 1.0), coll=coll)
            r = C.area_light('ins_rim', tuple(s + Vector((0.20, 0.10, 0.06))), tuple(s + Vector((0.0, 0.025, 0.0))),
                             0.05, 0.05, color=(1.0, 0.93, 0.85), coll=coll)
            # gold streak: for a barrel along +Y seen from the lens direction V, the mirror
            # direction off its upper flank is R = (-0.33, -0.5, 0.8) (R_y = -V_y); a card
            # long along Y out along R lays one streak the barrel's whole length
            st = C.area_light('ins_streak', tuple(s + Vector((-0.08, 0.02 - 0.12, 0.19))),
                              tuple(s + Vector((0.0, 0.022, 0.0))), 0.28, 0.05, 0.22, color=(1.0, 0.92, 0.78),
                              coll=coll)
            aim_light(st, (s + Vector((0.0, 0.022, 0.0))) - st.location)
            for l in (b, r):
                l.visible_camera = False
                l.visible_glossy = False
                l.data.spread = math.radians(60)
            # the soft warm field the gold barrel and the brass mirror on their lower flanks:
            # glossy only, linked to the jack and socket (the walnut keeps the diffuse bounce)
            gf.visible_camera = False
            gf.visible_diffuse = False
            gf.visible_transmission = False
            gf.visible_glossy = True
            gf.data.spread = math.radians(60)
            _link_light(gf, _meshes(self.jack.root) + _meshes(self.socket), 'LR_ins_jack_field_receivers')
            k.visible_camera = False
            k.visible_glossy = True
            k.data.spread = math.radians(60)
            st.visible_camera = False
            st.visible_diffuse = False
            st.visible_glossy = True
            st.visible_transmission = False
            _link_light(st, _meshes(self.jack.root) + _meshes(self.socket) + [self.master.obj], 'LR_ins_jack_receivers')
            out.update(bounce=b, kicker=k, rim=r, streak=st, gold_field=gf)
            if dust:
                # specks in the sunlit gap between the head edge and him, in front of the S10
                # lens (never round it: the lens sits at y ~0.28)
                out['dust'] = P.dust_motes('ins_dust', coll, center=(0.24, 0.13, 0.78), size=(0.22, 0.16, 0.12), n=70,
                                           cache_dir=cache_dir, radius=(0.0003, 0.0007))
        elif kind == 'padlock':
            if 'card' in self.insert:
                return {'card': self.insert['card']}
            tgt = target or self.props['kevin'][0]
            bpy.context.view_layer.update()
            p = tgt.matrix_world.translation.copy()
            if card_dir is None:
                # the lens sits on the far side from Kevin's screen; the card goes where the
                # broad face mirrors that view, so the brass reflects a soft warm field
                crt = self.terminals['kevin'].to_world((0.0, P.CRT['front'], P.CRT['zs']))
                v = (Vector((p.x, p.y, 0)) - Vector((crt.x, crt.y, 0))).normalized()
                n = tgt.matrix_world.to_3x3() @ Vector((0.0, 1.0, 0.0))
                n = Vector((n.x, n.y, 0.0)).normalized()
                if n.dot(v) < 0:
                    n = -n
                card_dir = (n * (2.0 * n.dot(v)) - v).normalized()
            pos = p + Vector(card_dir).normalized() * 0.55 + Vector((0.0, 0.0, 0.20))
            c = C.area_light('ins_padlock_card', tuple(pos), tuple(p + Vector((0, 0, 0.03))), 1.0, 0.62, 0.30,
                             color=(1.0, 0.76, 0.48), coll=coll)
            _link_light(c, _meshes(tgt), 'LR_ins_padlock_receivers')
            bpy.context.view_layer.update()
            c.parent = tgt
            c.matrix_parent_inverse = tgt.matrix_world.inverted()
            c.visible_camera = False
            for f, vis in tgt.get('vis_keys', []):
                _key_hidden(c, int(f), vis < 0.5)
            out['card'] = c
        elif kind == 'zero':
            # the glass zero (S07, macros): two thin strip cards that only the glass sees and
            # mirrors, riding with it, so its rims draw crisp bright edges instead of reading
            # as dark smoked glass on the dark walnut; inherits the zero's visibility keys
            if 'zero_key' in self.insert:
                return {k: self.insert[k] for k in ('zero_key', 'zero_rim')}
            tgt = target or self.props['linda'][0]
            bpy.context.view_layer.update()
            p = tgt.matrix_world.translation.copy()
            zk = C.area_light('ins_zero_key', tuple(p + Vector((-0.26, 0.16, 0.24))), tuple(p + Vector((0, 0, 0.012))),
                              3.0, 0.42, 0.03, color=(0.95, 0.97, 1.0), coll=coll)
            zr = C.area_light('ins_zero_rim', tuple(p + Vector((0.22, -0.26, 0.07))), tuple(p + Vector((0, 0, 0.012))),
                              1.6, 0.30, 0.02, color=(1.0, 0.93, 0.84), coll=coll)
            bpy.context.view_layer.update()
            for l in (zk, zr):
                l.visible_camera = False
                l.visible_diffuse = False
                _link_light(l, [tgt], 'LR_ins_zero_receivers')
                l.parent = tgt
                l.matrix_parent_inverse = tgt.matrix_world.inverted()
                for f, vis in tgt.get('vis_keys', []):
                    _key_hidden(l, int(f), vis < 0.5)
            out.update(zero_key=zk, zero_rim=zr)
        elif kind == 'lid':
            # S02's opening macro: a low raking key across the lid (light-linked to the cup
            # and lid only) so the embossed rings and the spout read under a top-down lens,
            # and a soft cool fill from the other side
            if 'lid_rake' in self.insert:
                return {k: self.insert[k] for k in ('lid_rake', 'lid_fill')}
            cup = target or _stand_in_cup(self)
            bpy.context.view_layer.update()
            sl = cup.slot.matrix_world.translation.copy()
            ctr = cup.root.matrix_world @ Vector((0.0, 0.0, 0.128))
            rk = C.area_light('ins_lid_rake', tuple(ctr + Vector((-0.42, -0.20, 0.07))), tuple(ctr), 1.4, 0.22, 0.05,
                              color=(1.0, 0.94, 0.86), coll=coll)
            fl = C.area_light('ins_lid_fill', tuple(ctr + Vector((0.30, 0.25, 0.30))), tuple(sl), 0.6, 0.3, 0.3,
                              color=(0.9, 0.94, 1.0), coll=coll)
            for l in (rk, fl):
                l.visible_camera = False
                _link_light(l, _meshes(cup.root), 'LR_ins_lid_receivers')
            out.update(lid_rake=rk, lid_fill=fl)
        elif kind == 'sip':
            if 'sip_key' in self.insert:
                return {k: self.insert[k] for k in ('sip_key', 'sip_rim')}
            sp = Vector(SYNERGY_POS)
            cup = sp + Vector((-0.12, -0.24, 1.40))          # around the cup at the chin
            kl = C.area_light('ins_sip_key', tuple(sp + Vector((-0.95, -0.75, 1.38))), tuple(cup), 1.6, 0.28, 0.22,
                              color=(0.92, 0.95, 1.0), coll=coll)
            kl.visible_camera = False
            kl.visible_glossy = False
            rl = C.area_light('ins_sip_rim', tuple(sp + Vector((-0.30, 0.35, 1.78))), tuple(cup + Vector((0, 0, 0.06))),
                              0.35, 0.22, 0.035, color=(0.95, 0.97, 1.0), coll=coll)
            rl.visible_camera = False
            cups = list(target) if target else [o for o in bpy.context.scene.objects
                                                if o.type == 'MESH' and o.name.endswith(('_cup_cup', '_cup_lid'))]
            if cups:
                _link_light(kl, cups, 'LR_ins_sip_receivers')
                _link_light(rl, cups, 'LR_ins_sip_receivers')
            out.update(sip_key=kl, sip_rim=rl)
        else:
            raise KeyError(kind)
        self.insert.update(out)
        return out

    def use_kits(self, *kinds):
        """Show only the named insert kits (collection-level hide_render on the others)."""
        for kind, coll in self.kits.items():
            coll.hide_render = kind not in kinds
            coll.hide_viewport = kind not in kinds

    # --- render settings
    def render_budget(self, scene=None, still=False, samples=None, kind='wide', tier=None, locked=False):
        """Room-level render settings (opt in; build() no longer applies them).

        kind 'wide' (S03/S07/S11/S13): diffuse 2 / glossy 2 bounces (the coat is a 2-bounce
        mirror; transmission chains up to 8 for the stacked tabs and the zero), adaptive
        stopping at 0.06, 12 spp at the final tier. 'macro' (S02/S04/S09/S10 inserts at
        f/2.8-8): diffuse 1 / glossy 2, adaptive 0.03 with at least 8 samples, 16 spp at the
        final tier (held beats must not boil). Uniform light picking for both.
        locked=True (a locked-off camera: S05, S09, S10, S11, S13 - see LOCKED_OFF) fixes
        the sampling seed, so static content renders identical noise every frame and the
        denoiser cannot crawl; moving cameras keep the animated seed.
        Sample clamps apply at the 'final' tier only and never to an explicit sample count
        (`samples`, or a scene count that differs from the tier's default); 'hero' and the
        preview tiers keep their samples. Calling it again with another kind first restores
        the scene's own settings. Prints the effective settings."""
        sc = scene or bpy.context.scene
        cy = sc.cycles
        if self._budget_base is None:
            self._budget_base = dict(samples=cy.samples, threshold=cy.adaptive_threshold,
                                     min_samples=cy.adaptive_min_samples, blur=sc.render.use_motion_blur,
                                     dq=getattr(cy, 'denoising_quality', None), pre=cy.denoising_prefilter,
                                     seed=cy.use_animated_seed)
        base = self._budget_base
        cy.samples = base['samples']
        cy.use_animated_seed = base.get('seed', True) and not locked
        cy.adaptive_threshold = base['threshold']
        cy.adaptive_min_samples = base['min_samples']
        sc.render.use_motion_blur = base['blur']
        if base['dq'] is not None:
            cy.denoising_quality = base['dq']
        cy.denoising_prefilter = base['pre']
        if tier is None:
            res = (sc.render.resolution_x, sc.render.resolution_y)
            tier = next((k for k, v in C.QUALITY.items() if (v[0], v[1]) == res), None)
        b = BUDGET[kind]
        cy.max_bounces = b['max_bounces']
        cy.diffuse_bounces = b['diffuse']
        cy.glossy_bounces = b['glossy']
        cy.transmission_bounces = b['transmission']
        cy.transparent_max_bounces = b['transparent']
        cy.volume_bounces = b['volume']
        cy.use_light_tree = False           # ~20 lights, mostly local: uniform picking is cheaper here
        tier_spp = C.QUALITY[tier][2] if tier in C.QUALITY else None
        explicit = samples is not None or (tier_spp is not None and base['samples'] != tier_spp)
        if samples:
            cy.samples = samples
        if tier == 'final':
            cy.adaptive_threshold = max(cy.adaptive_threshold, b['threshold'])
            cy.adaptive_min_samples = b['min_samples']
            if not explicit:
                cy.samples = b['final_spp']
            if hasattr(cy, 'denoising_quality') and cy.denoising_quality == 'HIGH':
                cy.denoising_quality = 'BALANCED'
            cy.denoising_prefilter = 'FAST'     # the albedo/normal passes are clean at 12 spp
        elif tier not in ('hero',) and kind == 'wide':
            cy.adaptive_threshold = max(cy.adaptive_threshold, 0.0)
        cy.adaptive_min_samples = min(cy.adaptive_min_samples, cy.samples)
        if still:
            sc.render.use_motion_blur = False
        print(f'RENDER BUDGET kind={kind} tier={tier} spp={cy.samples} adaptive={cy.adaptive_threshold:.3f} '
              f'min={cy.adaptive_min_samples} bounces={cy.max_bounces}/{cy.diffuse_bounces}/{cy.glossy_bounces} '
              f'denoise={getattr(cy, "denoising_quality", "-")}/{cy.denoising_prefilter} blur={sc.render.use_motion_blur} '
              f'animated_seed={cy.use_animated_seed}', flush=True)
        return sc

    def compositor(self, glare=0.35, mist_amount=0.55, vignette=0.25, threshold=0.9):
        """House look: fog-glow glare, mist-pass depth haze, a soft vignette. Built on
        common.compositor, with the vignette's mask blurred by a recursive (fast) Gaussian
        instead of a 560 px convolution, and the glare at medium quality: the same look for
        a fraction of the compositing cost. threshold: where the glare starts (macro
        inserts use ~1.6 so sunlit paper and brass keep their detail)."""
        nt = C.compositor(glare=glare, glare_threshold=threshold, glare_size=8, vignette=vignette,
                          mist=dict(color=(0.006, 0.008, 0.016), start=6.0, depth=46.0, amount=mist_amount,
                                    falloff='LINEAR'))
        for n in nt.nodes:
            if n.type == 'BLUR':
                n.filter_type = 'FAST_GAUSS'
            elif n.type == 'GLARE':
                n.quality = 'MEDIUM'
        return nt


def _bokeh_mat():
    """A defocused screen: a flat disc with a slightly brighter rim and a soft edge (it reads
    as a lens's bokeh even where the camera has no depth of field)."""
    m = bpy.data.materials.get('lr_front_bokeh')
    if m is not None:
        return m
    m = bpy.data.materials.new('lr_front_bokeh')
    g = P.G(m, principled=False)
    u, v, _ = g.sep(g.uv())
    du, dv = g.sub(u, 0.5), g.sub(v, 0.5)
    r = g.mul(g.math('SQRT', g.add(g.mul(du, du), g.mul(dv, dv))), 2.0)
    prof = g.mul(g.remap(r, 1.0, 0.86, smooth=True), g.add(0.82, g.mul(g.remap(r, 0.55, 0.93, smooth=True), 0.25)))
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


def _meshes(root_obj):
    out, stack = [], [root_obj]
    while stack:
        o = stack.pop()
        stack.extend(o.children)
        if o.type in ('MESH', 'CURVE'):
            out.append(o)
    return out


def _link_light(light, receivers, name):
    """Light linking: `light` lights (and shows in) only `receivers`, so an insert card
    never paints the walnut or the room around the hero object."""
    coll = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    for o in receivers:
        if coll.objects.get(o.name) is None:
            coll.objects.link(o)
    light.light_linking.receiver_collection = coll
    return coll


def _unlink_light(light, excluded, name):
    """Light linking by exclusion: `light` lights everything except `excluded`."""
    coll = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    for o in excluded:
        if coll.objects.get(o.name) is None:
            coll.objects.link(o)
    for co in coll.collection_objects:
        co.light_linking.link_state = 'EXCLUDE'
    light.light_linking.receiver_collection = coll
    return coll


def _key_hidden(o, frame, hidden):
    """Constant visibility keys on one object (render and viewport)."""
    for path in ('hide_render', 'hide_viewport'):
        setattr(o, path, not hidden)
        o.keyframe_insert(path, frame=frame - 1)
        setattr(o, path, hidden)
        o.keyframe_insert(path, frame=frame)
    ad = o.animation_data
    if ad and ad.action:
        for fc in C.fcurves(ad.action):
            if fc.data_path in ('hide_render', 'hide_viewport'):
                for kp in fc.keyframe_points:
                    kp.interpolation = 'CONSTANT'


# ================================================================== builders


def _shell(room, coll):
    x0, x1 = ROOM['interior_x']
    y0, y1 = ROOM['interior_y']
    z1 = ROOM['interior_z'][1]
    # floor
    floor = P.box('room_floor', (x1 - x0 + 0.6, y1 - y0 + 0.6, 0.02), ((x0 + x1) / 2, (y0 + y1) / 2, -0.01),
                  P.carpet(), coll)
    # structural walls (near-black), lined with fabric acoustic panels; the 12 mm gaps
    # between panels fall to this black, a crisp shadow-gap rhythm
    back = P.flat((0.0025, 0.0025, 0.003), 0.9)
    T = 0.3
    walls = {
        'left': P.box('wall_left', (T, y1 - y0 + 2 * T, z1 + 0.6), (x0 - T / 2 - 0.05, (y0 + y1) / 2, z1 / 2 + 0.3), back, coll),
        'right': P.box('wall_right', (T, y1 - y0 + 2 * T, z1 + 0.6), (x1 + T / 2 + 0.05, (y0 + y1) / 2, z1 / 2 + 0.3), back, coll),
        'foot': P.box('wall_foot', (x1 - x0 + 2 * T, T, z1 + 0.6), ((x0 + x1) / 2, y0 - T / 2 - 0.05, z1 / 2 + 0.3), back, coll),
        'head': P.box('wall_head', (x1 - x0 + 2 * T, T, z1 + 0.6), ((x0 + x1) / 2, y1 + T / 2 + 0.05, z1 / 2 + 0.3), back, coll),
    }
    room.walls = {k: [v] for k, v in walls.items()}
    # one acoustic panel mesh, linked everywhere (Cycles instances it)
    pw, ph, pd = 1.186, 5.70, 0.05
    bm = bmesh.new()
    P.bm_pillow(bm, pw, pd, ph, 0.004, 0.004, steps=2, seg=3)
    pmesh = P.to_object(bm, 'acoustic_panel_src', [P.acoustic()], coll, smooth=40.0, recalc=False)
    me = pmesh.data
    bpy.data.objects.remove(pmesh)
    z0 = 0.13
    pitch = 1.2
    # long walls
    for side, key in ((-1, 'left'), (1, 'right')):
        n = int((y1 - y0) // pitch)
        start = (y0 + y1) / 2 - (n - 1) * pitch / 2
        for i in range(n):
            o = bpy.data.objects.new(f'panel_{key}_{i}', me)
            coll.objects.link(o)
            o.location = (side * (x1 + 0.05 - pd / 2), start + i * pitch, z0)
            o.rotation_euler = (0, 0, math.pi / 2)
            room.walls[key].append(o)
    for side, key, yy in ((-1, 'foot', y0), (1, 'head', y1)):
        n = int((x1 - x0) // pitch)
        start = -(n - 1) * pitch / 2
        for i in range(n):
            o = bpy.data.objects.new(f'panel_{key}_{i}', me)
            coll.objects.link(o)
            o.location = (start + i * pitch, yy + side * (0.05 - pd / 2), z0)
            room.walls[key].append(o)
    # black shadow-gap skirting
    sk = P.flat((0.002, 0.002, 0.002), 0.6)
    for key, (cx, cy, sx, sy) in {
        'left': (x0 - 0.04, (y0 + y1) / 2, 0.04, y1 - y0), 'right': (x1 + 0.04, (y0 + y1) / 2, 0.04, y1 - y0),
        'foot': (0.0, y0 - 0.04, x1 - x0, 0.04), 'head': (0.0, y1 + 0.04, x1 - x0, 0.04),
    }.items():
        o = P.box(f'skirt_{key}', (sx, sy, 0.12), (cx, cy, 0.06), sk, coll)
        room.walls[key].append(o)
    return floor


def _ceiling_and_skylight(room, coll):
    x0, x1 = ROOM['interior_x']
    y0, y1 = ROOM['interior_y']
    z = ROOM['interior_z'][1]
    L, W, cy, dep = ROOM['skylight_len'], ROOM['skylight_w'], ROOM['skylight_cy'], ROOM['skylight_depth']
    # ceiling: a slab with the rounded slot cut clean through it (exact boolean)
    hole = [(-y, x) for x, y in P.stadium(L, W, 32)]
    hole = [(x, y + cy) for x, y in hole]
    ceil = P.box('ceiling', (x1 - x0 + 0.8, y1 - y0 + 0.8, 0.25), ((x0 + x1) / 2, (y0 + y1) / 2, z + 0.125),
                 P.flat((0.008, 0.0085, 0.01), 0.85), coll)
    bm = bmesh.new()
    P.bm_prism(bm, hole, z - 0.1, z + 0.4)
    cutter = P.to_object(bm, 'ceiling_slot_cutter', [], coll)
    cutter.hide_render = True
    cutter.hide_viewport = True
    bo = ceil.modifiers.new('Slot', 'BOOLEAN')
    bo.operation = 'DIFFERENCE'
    bo.solver = 'EXACT'
    bo.object = cutter
    # light well: plaster walls around the slot, slightly flared, sunlit warm toward the top
    bm = bmesh.new()
    hi_outline = [(-y, x) for x, y in P.stadium(L + 0.02, W + 0.02, 32)]
    hi_outline = [(x, y + cy) for x, y in hi_outline]
    lo = [(x, y, z - 0.002) for x, y in hole]
    hi = [(x, y, z + dep) for x, y in hi_outline]
    P.bm_loft(bm, [lo, hi], True, False, False, 0)
    well = P.to_object(bm, 'skylight_well', [P.skylight_well(z, dep)], coll, smooth=40.0)
    # diffuser: the daylight slot seen from below, a soft centre-to-edge gradient that peaks
    # near 0.85 display. Seen only by camera and glossy rays (40% for glossy), no fill, no
    # light sampling, no shadow: the sun alone lays the slab. The 20 mm glazing bars every
    # 2.6 m live in its emission as a faint dip (no mullion geometry: no ladder).
    bm = bmesh.new()
    vs = P.bm_ring(bm, [(x, y, z + dep - 0.02) for x, y in hi_outline])
    P.bm_cap(bm, vs, 0, flip=True)
    diff = P.to_object(bm, 'skylight_diffuser',
                       [P.skylight_diffuser(LIGHT['diffuser'], W + 0.02, ROOM['mullion_pitch'])], coll, smooth=None,
                       recalc=False)
    diff.visible_shadow = False
    diff.visible_diffuse = False
    diff.visible_transmission = False
    diff.visible_volume_scatter = False
    # make sure the emitting face points down into the room
    me = diff.data
    if me.polygons[0].normal.z > 0:
        me.flip_normals()
    mat = diff.data.materials[0]
    mat.cycles.emission_sampling = 'NONE'
    room.diffuser = diff
    room.diffuser_strength = _emission_strength_socket(mat)
    room.diffuser_mat = mat
    room.mullions = None
    room.ceiling = ceil
    room.well = well
    # the sun: hard 6500K slab down the spine, tilted so it reaches over the host
    sun = C.sun_light('room_sun', (ROOM['sun_tilt_deg'], 0, 0), LIGHT['sun'], LIGHT['sun_angle'], coll=coll)
    sun.data.use_temperature = True
    sun.data.temperature = 6500
    room.sun = sun
    room.sun_rot = tuple(sun.rotation_euler)
    # the same slab again on the walnut only (light-linked in build): the hard 6500K band
    # reads on the dark coat without over-lighting him, the props or the paper
    st = C.sun_light('room_sun_table', (ROOM['sun_tilt_deg'], 0, 0), LIGHT['sun_table'], LIGHT['sun_angle'],
                     coll=coll)
    st.data.use_temperature = True
    st.data.temperature = 6500
    room.sun_table = st
    return ceil


def _emission_strength_socket(mat):
    for n in mat.node_tree.nodes:
        if n.type == 'EMISSION':
            # strength is driven by (pattern * strength): find the multiply feeding it
            link = n.inputs['Strength'].links
            if link:
                src = link[0].from_node
                return src.inputs[1]
            return n.inputs['Strength']
    raise RuntimeError('no emission')


def _terminal_matrix(name, yaw_deg):
    """World matrix of a colleague's terminal root (on the crowned seat, against the chair back)."""
    side, y = SEATS[name]
    x = side * ROOM['chair_x']
    rot = seat_rot(name, yaw_deg)
    fwd = Vector((-math.sin(rot), math.cos(rot), 0.0))
    loc = Vector((x, y, ROOM['seat_rest_z'])) + fwd * 0.06
    return Matrix.Translation(loc) @ Matrix.Rotation(rot, 4, 'Z')


def _grommet_y(name):
    """Where a colleague's cord enters the brass channel (the inner end of its groove):
    just up-table of the seat, the same on both sides, so facing pairs form one chevron."""
    side, y = SEATS[name]
    return y + GROOVE['in_dy']


def groove_ends(name):
    """(outer, inner) plan points of a colleague's cord groove's long diagonal: `outer` at
    the elbow just inboard of the table's long edge (the stub runs from there square out
    through the edge), `inner` on the channel wall at _grommet_y. The cord lies flush in it,
    so every slide lane crosses it at walnut level."""
    side, y = SEATS[name]
    hw = ROOM['table_half_w']
    outer = Vector((side * (hw - GROOVE['stub']), y + GROOVE['out_dy']))
    inner = Vector((side * ROOM['channel_width'] / 2, _grommet_y(name)))
    return outer, inner


def _liner_outline(c0, c1, r, gaps):
    """Closed polyline (x, y, outward nx, ny, in_gap_after) of the channel's inner wall, CCW
    from above, with breakpoints at the groove notches. gaps: {side: [(ya, yb), ...]}."""
    pts = []

    def straight(side, ya, yb):
        ys = {ya, yb}
        for a, b in gaps.get(side, []):
            if ya < a < yb:
                ys.add(a)
            if ya < b < yb:
                ys.add(b)
        seq = sorted(ys, reverse=(side < 0))
        for yy in seq:
            pts.append((side * r, yy, float(side), 0.0))
    n = 24
    straight(1, c0 + r, c1 - r)                         # his-left wall, toward the head
    for i in range(1, n):                                # head end semicircle
        a = math.pi * i / n
        pts.append((r * math.cos(a), c1 - r + r * math.sin(a), math.cos(a), math.sin(a)))
    straight(-1, c0 + r, c1 - r)                         # his-right wall, toward the foot
    for i in range(1, n):                                # foot end semicircle
        a = math.pi + math.pi * i / n
        pts.append((r * math.cos(a), c0 + r + r * math.sin(a), math.cos(a), math.sin(a)))
    out = []
    for i, (x, y, nx, ny) in enumerate(pts):
        x2, y2 = pts[(i + 1) % len(pts)][:2]
        mx, my = (x + x2) / 2, (y + y2) / 2
        side = 1 if mx > 0 else -1
        gap = abs(abs(mx) - r) < 1e-6 and any(a <= my <= b for a, b in gaps.get(side, []))
        out.append((x, y, nx, ny, gap))
    return out


def _channel_liner(room, coll, gaps):
    """The brass liner, inlaid flush: a 5 mm lip level with the walnut (0.2 mm chamfers both
    sides) over polished walls, a solid 5 x 11.5 mm section, notched open where each cord's
    groove comes in. Material 0 = the lip, 1 = the aged walls, 2 = the brushed band under
    the lip. UV u runs down the table (the lip's anisotropy)."""
    tz = ROOM['table_top_z']
    cd = ROOM['channel_depth']
    c0, c1 = ROOM['channel_y']
    r = ROOM['channel_width'] / 2
    L = GROOVE['lip']
    prof = [(L, tz - 0.0040), (L, tz - 0.0002), (L - 0.0002, tz), (0.0002, tz), (0.0, tz - 0.0002),
            (0.0, tz - 0.0015), (0.0, tz - cd + 0.0002), (L, tz - cd + 0.0002)]
    mats = [0, 0, 0, 2, 2, 1, 1, 1]            # material of the face from profile point k to k+1
    outline = _liner_outline(c0, c1, r, gaps)
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.new('UVMap')
    rings = []
    for x, y, nx, ny, _ in outline:
        rings.append([bm.verts.new((x + nx * o, y + ny * o, z)) for o, z in prof])
    npf = len(prof)
    nrm = len(outline)
    for i in range(nrm):
        if outline[i][4]:
            continue
        a, b = rings[i], rings[(i + 1) % nrm]
        for k in range(npf):
            f = bm.faces.new((a[k], a[(k + 1) % npf], b[(k + 1) % npf], b[k]))
            f.material_index = mats[k]
        # cap the open ends at each notch
        if outline[i - 1][4]:
            f = bm.faces.new(list(reversed(a)))
            f.material_index = 1
        if outline[(i + 1) % nrm][4]:
            f = bm.faces.new(b)
            f.material_index = 1
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        for lp in f.loops:
            lp[uvl].uv = (lp.vert.co.y, lp.vert.co.x + lp.vert.co.z)
    return P.to_object(bm, 'brass_channel', [P.brass('lip'), P.brass('aged'), P.brass('brushed')], coll, smooth=35.0,
                       recalc=False)


def _table_slab(name, ya, yb, mat, coll):
    tz, bz = ROOM['table_top_z'], ROOM['table_bottom_z']
    hw = ROOM['table_half_w']
    # cross-section (x, z): square top edge, slim undercut chamfer below
    sec = [(-hw, tz), (-hw, bz + 0.02), (-hw + 0.035, bz), (hw - 0.035, bz), (hw, bz + 0.02), (hw, tz)]
    bm = bmesh.new()
    a = P.bm_ring(bm, [(x, ya, z) for x, z in sec])
    b = P.bm_ring(bm, [(x, yb, z) for x, z in sec])
    P.bm_bridge(bm, a, b, 0)
    P.bm_cap(bm, a, 0)
    P.bm_cap(bm, b, 0, flip=True)
    return P.to_object(bm, name, [mat], coll, smooth=30.0)


def _table(room, coll):
    tz = ROOM['table_top_z']
    ya, yb = ROOM['table_y']
    hw = ROOM['table_half_w']
    bb = GROOVE['breadboard']
    # the field: book-matched long-grain boards; at each end a breadboard (grain across the
    # table) closes the end grain, so the head edge round the socket reads as long grain
    top = _table_slab('table_top', ya + bb + 0.00025, yb - bb - 0.00025, P.walnut(), coll)
    ends = [_table_slab('table_end_head', yb - bb + 0.00025, yb, P.walnut('X'), coll),
            _table_slab('table_end_foot', ya, ya + bb - 0.00025, P.walnut('X'), coll)]
    # cutters: the rounded-slot cable channel down the spine with a 4 mm rebate for the
    # inlaid brass lip, and one straight cord groove per colleague (one exact boolean)
    cut_coll = bpy.data.collections.new('LR_table_cutters')
    c0, c1 = ROOM['channel_y']
    cw, cd = ROOM['channel_width'], ROOM['channel_depth']
    for nm, wid, z0 in (('table_channel_cutter', cw + 0.003, tz - cd),
                        ('table_lip_rebate', cw + 2 * GROOVE['lip'] + 0.0002, tz - 0.004)):
        cut = [(-y, x) for x, y in P.stadium(c1 - c0, wid, 24)]
        cut = [(x, y + (c0 + c1) / 2) for x, y in cut]
        bm = bmesh.new()
        P.bm_prism(bm, cut, z0, tz + 0.05)
        P.to_object(bm, nm, [], cut_coll)
    room.bores = {}
    room.grooves = {}
    gaps = {-1: [], 1: []}
    gw = GROOVE['width']
    for name in TERMINALS:
        side, _ = SEATS[name]
        o, i = groove_ends(name)
        for k, (a, b) in enumerate(((Vector((side * (hw + 0.06), o.y)), o + Vector((-side * 0.004, 0.0))),
                                    (o, i))):
            d = (b - a).normalized()
            nrm = Vector((-d.y, d.x))
            a = a - d * (0.004 if k else 0.0)
            b = b + d * 0.012
            poly = [a - nrm * gw / 2, b - nrm * gw / 2, b + nrm * gw / 2, a + nrm * gw / 2]
            bm = bmesh.new()
            P.bm_prism(bm, [(p.x, p.y) for p in poly], tz - cd, tz + 0.05)
            P.to_object(bm, f'table_groove_{name}_{k}', [], cut_coll)
        bm = bmesh.new()                       # the elbow, rounded so the coil can turn in it
        P.bm_prism(bm, [(o.x + 0.0115 * math.cos(2 * math.pi * j / 20), o.y + 0.0115 * math.sin(2 * math.pi * j / 20))
                        for j in range(20)], tz - cd, tz + 0.05)
        P.to_object(bm, f'table_groove_{name}_elbow', [], cut_coll)
        d = (i - o).normalized()
        room.bores[name] = i.y
        room.grooves[name] = (o, i)
        half = (gw / 2) / max(abs(d.x), 0.2) + 0.0015
        gaps[side].append((i.y - half, i.y + half))
    for o in cut_coll.objects:
        o.hide_render = True
        o.hide_viewport = True
    bo = top.modifiers.new('Cutters', 'BOOLEAN')
    bo.operation = 'DIFFERENCE'
    bo.solver = 'EXACT'
    bo.operand_type = 'COLLECTION'
    bo.collection = cut_coll
    P.soft_bevel(top, 0.0025, 3, 30)
    # the socket bore in the head breadboard
    sx, sy, sz = ROOM['socket_pos']
    bore_coll = bpy.data.collections.new('LR_table_bore')
    hole = P.cylinder('table_socket_bore', 0.0046, 0.03, (sx, sy, sz), None, bore_coll, 24, 'Y')
    hole.hide_render = hole.hide_viewport = True
    bo = ends[0].modifiers.new('Socket', 'BOOLEAN')
    bo.operation = 'DIFFERENCE'
    bo.solver = 'EXACT'
    bo.operand_type = 'COLLECTION'
    bo.collection = bore_coll
    for e in ends:
        P.soft_bevel(e, 0.0025, 3, 30)
    room.table = top
    room.table_ends = ends
    room.table_cutters = cut_coll
    room.channel = _channel_liner(room, coll, gaps)
    room.grommets = None
    # plinth: a recessed black monolith under the slab
    pw = ROOM['plinth_half_w']
    p0, p1 = ROOM['plinth_y']
    ptop = ROOM['plinth_top_z']
    plinth = P.box('table_plinth', (2 * pw, p1 - p0, ptop - 0.06), (0, (p0 + p1) / 2, (ptop - 0.06) / 2 + 0.06),
                   P.lacquer_black(), coll, 0.004)
    P.box('table_plinth_toe', (2 * pw - 0.08, p1 - p0 - 0.08, 0.06), (0, (p0 + p1) / 2, 0.03),
          P.flat((0.002, 0.002, 0.002), 0.7), coll)
    room.plinth = plinth
    return top


def walnut_objects(room):
    """The walnut surfaces (field + breadboard ends): what the streak cards light."""
    return [room.table] + list(getattr(room, 'table_ends', []))


def _seats(room, coll):
    for name, (side, y) in SEATS.items():
        if name == 'droid_bay':
            continue
        x = side * ROOM['chair_x']
        rot = seat_rot(name, room.seat_yaw)
        ch = P.office_chair(f'chair_{name}', coll, (x, y, 0.0), rot)
        room.chairs[name] = ch
        mw = _terminal_matrix(name, room.seat_yaw)
        rgb = P.srgb(P.TERMINAL_HEX[name])
        # pool energy: luminance-normalised, times a per-colleague trim (a deep saturated
        # burgundy pool at full energy reads as a red lamp on the walnut, not a screen's spill)
        e = 22.0 * LIGHT['crt'] * min(2.2, 0.45 / max(P._luma(rgb), 0.2) ** 0.5) * P.CRT_CAL.get(name, {}).get('pool', 1.0)
        t = P.crt_terminal(name, P.TERMINAL_HEX[name], coll, tuple(mw.translation), rot,
                           powered=(name != 'pat'), energy=LIGHT['pat'] if name == 'pat' else e)
        room.terminals[name] = t
        # its streak in the walnut: a glossy-only card over the table, inboard of the screen,
        # light-linked to the walnut alone (see _link_streaks). 5.5 m long, so each streak drips
        # from its own screen and fades out before the next seat's (5 m on); alternate seats
        # sit 6 cm in or out, and the far end never passes the table's foot
        k = [n for n, (sd, _) in sorted(SEATS.items(), key=lambda it: -it[1][1]) if sd == side].index(name)
        sx = side * (ROOM['streak_x'] + (0.05 if k % 2 == 0 else -0.05))
        room.streaks[name] = P.crt_streak_card(t, f'streak_{name}', coll,
                                               (sx, y, ROOM['streak_z'] + 0.002 * y),
                                               size=(LIGHT['streak_w'], LIGHT['streak_len']), gain=LIGHT['streak'],
                                               head=LIGHT['streak_head'], y_min=ROOM['table_y'][0] + 0.05)
    _link_streaks(room)
    # the dead colleague takes no colour from the live screens round it (Linda's glow faces
    # Pat's tube across the table in the foot wide): Pat reads neutral dark grey
    pat = room.terminals.get('pat')
    dead = [o for o in pat.root.children if o.type in ('MESH', 'EMPTY')] if pat is not None else []
    for nm, t in room.terminals.items():
        if nm != 'pat' and dead:
            _unlink_light(t.light, dead, 'LR_glow_excludes_pat')


def _link_streaks(room):
    """Every streak card lights (and is seen in) the walnut only: the brass, the padlock, the
    glass zero, the CRT glass and Synergy never mirror a card."""
    if not room.streaks:
        return
    for card in room.streaks.values():
        _link_light(card, walnut_objects(room), 'LR_walnut_receivers')


def _cord_points(room, name):
    """Centreline of a terminal's cord: out of the CRT, over the seat edge, a soft sag to the
    table's long edge and under its overhang (the cable cavity), along under the edge to its
    groove 2 m down-table, out from under the edge, up the edge face and round into the groove's
    stub, along the long diagonal (flush) into the brass channel, then a short curve into its
    own lane and along it to the hub. Room.cord_mode 'proud' (the S03 wide) lays the walnut run
    on top of the walnut instead (over its groove)."""
    side, y = SEATS[name]
    yaw = room.seat_yaw
    m = _terminal_matrix(name, yaw)
    tz, bz = ROOM['table_top_z'], ROOM['table_bottom_z']
    hw = ROOM['table_half_w']
    lane = LANES[name]
    cd = ROOM['channel_depth']
    cz = tz - cd + CORD_RC + 0.0001                        # flush: its crest 0.4 mm under the walnut
    s = side
    proud = getattr(room, 'cord_mode', 'flush') == 'proud'
    zr = tz + CORD_RC + 0.0004 if proud else cz            # the walnut run's centre height
    zf = tz if proud else tz - cd                          # the edge it wraps round (top or groove floor)
    zc = bz - 0.045                                        # the cable cavity under the walnut
    ex = m @ (Vector(P.CRT['cord_exit']) + Vector((0.0, 0.0085, 0.0)))     # just out of the CRT's grommet
    p1 = m @ Vector((0.0, 0.215, 0.012))
    p2 = m @ Vector((0.01, 0.262, -0.02))
    o, i = groove_ends(name)
    d2 = (i - o).normalized()
    d3 = Vector((d2.x, d2.y, 0.0))
    o3 = Vector((o.x, o.y, zr))
    i3 = Vector((i.x, i.y, cz))
    glen = (i - o).length
    ye = o.y
    sag = Vector(((p2.x + s * hw) / 2 + s * 0.06, p2.y - 0.05, 0.42))
    # the elbow from the stub (square to the edge) into the diagonal: a quadratic fillet that
    # stays inside the routed elbow (within 5 mm of its centre)
    u1 = Vector((-s, 0.0, 0.0))
    T1, T2 = o3 - u1 * 0.016, o3 + d3 * 0.016
    elbow = [T1 * (1 - t) ** 2 + o3 * (2 * t * (1 - t)) + T2 * t * t for t in (0.0, 0.25, 0.5, 0.75, 1.0)]
    pts = [
        ex, p1, p2,
        sag,
        Vector((s * (hw + 0.07), y - 0.15, 0.53)),
        Vector((s * (hw - 0.04), y - 0.40, zc)),             # under the overhang
        Vector((s * (hw - 0.06), y - 0.80, zc)),
        Vector((s * (hw - 0.06), ye + 0.40, zc)),
        Vector((s * (hw - 0.03), ye + 0.12, zc + 0.006)),
        Vector((s * (hw + 0.012), ye + 0.02, bz - 0.006)),    # out from under the edge
        Vector((s * (hw + 0.0125), ye, 0.705)),
        Vector((s * (hw + 0.0095), ye, zf - 0.006)),          # round the edge into the stub
        Vector((s * (hw + 0.0035), ye, zf + 0.0064)),
        Vector((s * (hw - 0.012), ye, zr)),
    ] + elbow + [
        o3 + d3 * 0.06,
        o3 + d3 * 0.15,
        o3 + d3 * (glen * 0.40),
        o3 + d3 * (glen * 0.75),
        i3 + Vector((0.0, 0.0, (zr - cz) * (0.55 if proud else 1.0))) - d3 * 0.030,
        i3 + d3 * 0.004,                                     # through the liner's notch
        i3 + d3 * 0.026,
        Vector((s * min(abs(lane) + 0.010, 0.0565), i.y + 0.07, cz)),
        Vector((lane, i.y + 0.14, cz)),
        Vector((lane, i.y + 0.24, cz)),
        Vector((lane, _cord_end_y(lane), cz)),
    ]
    return pts


def _cord_end_y(lane):
    """Where a lane's cord ends: against the channel's rounded head end, under the hub."""
    r = ROOM['channel_width'] / 2
    w = min(r - 0.0005, abs(lane) + CORD_RC + 0.0012)
    return ROOM['channel_y'][1] - r + math.sqrt(r * r - w * w) - 0.0035


def _cords(room, coll):
    room._built_cord_mode = getattr(room, 'cord_mode', 'flush')
    mat = P.cord_plastic()
    tz, cw = ROOM['table_top_z'], ROOM['channel_width']
    cz = tz - ROOM['channel_depth'] + CORD_RC + 0.0001
    for name in TERMINALS:
        pts = _cord_points(room, name)
        dense = P.catmull(pts[:-1], 8) + [pts[-1]]
        # the spline must not dip under its lying height where it settles into the channel
        dense = [Vector((p.x, p.y, max(p.z, cz))) if abs(p.x) < cw / 2 + 0.006 and p.z > tz - 0.03 else p
                 for p in dense]
        cord = P.build_coil(dense, f'cord_{name}', coll, pitch=0.0056, samples_per_turn=5, profile=4,
                            smooth_points=False, mat=mat)
        room.cords[name] = cord


def _head(room, coll):
    hub = P.conference_hub('hub', coll, ROOM['hub_pos'])
    room.hub = hub
    sock = P.brass_socket('socket', coll, ROOM['socket_pos'])
    room.socket = sock
    sx, sy, sz = ROOM['socket_pos']
    jack = P.gold_jack('jack', coll, (sx, sy + P.SOCKET_FACE, sz))
    room.jack = jack
    bpy.context.view_layer.update()
    mids = master_cord_mids(ROOM['socket_pos'], ROOM['table_top_z'])
    # the free run never sinks into the walnut when it springs (MasterCord.pulled): its control
    # points over the top (and the one rolling over the head edge) stay at least the coil's
    # outer radius + 0.5 mm above it
    room.master = P.master_cord(hub.port, jack.root, jack.tail_local, mids, 'master_cord', coll, turns=92,
                                floor_z=TABLE_TOP + MASTER_RC, floor_xy=(-0.8, 0.8, -30.0, 0.02))


def master_cord_mids(socket_pos, tz, origin=(0.0, 0.0, 0.0)):
    """Free control points of the master cord: across the walnut from the hub, over the
    head edge, then down and round to the jack's tail. `origin` offsets the layout."""
    o = Vector(origin)
    sx, sy, sz = socket_pos
    rc = MASTER_RC
    return [o + Vector(v) for v in ((0.045, -0.165, tz + rc), (0.13, -0.085, tz + rc), (0.195, -0.018, tz + rc),
                                    (sx - 0.004, 0.016, tz + rc + 0.004), (sx, 0.065, tz - 0.012))]


def _problem_props(room, coll):
    for name, kinds in PROPS.items():
        objs = []
        side, y = SEATS[name]
        for i, kind in enumerate(kinds):
            x, yy = prop_home(name, i)
            loc = (x, yy, ROOM['table_top_z'])
            if kind == 'padlock':
                # broad faces look down-table, square to its slide to the fingertip: the
                # S04/S09 lenses see the scratched face and the leading face meets the finger flat
                o = P.padlock(f'padlock_{name}', coll, loc, math.radians(-4))
            elif kind == 'glass_zero':
                o = P.glass_zero(f'zero_{name}', coll, loc)
            elif kind == 'envelope':
                o = P.envelope(f'envelope_{name}{i}', coll, loc, math.radians(90 + side * 4),
                               seed=TERMINALS.index(name) * 3 + i)
            else:
                o = P.tab_stack(f'tabs_{name}{i}', coll, loc, math.radians(side * 90 + 6 * (i - 0.5)))
            objs.append(o)
        room.props[name] = objs


def _printer(room, coll):
    cx, cy, _ = ROOM['printer_chair']
    ch = P.office_chair('chair_printer', coll, (cx, cy, 0.0), 0.0, low=True)   # low back: it reads from behind
    room.chairs['printer'] = ch
    seat = ROOM['seat_rest_z']
    py = cy + 0.02
    sx, sy, _ = ROOM['printer_stack']
    pr = P.laser_printer('printer', coll, (cx, py, seat), 0.0,
                         stack_offset=(sx - cx, sy - py, 0.0), stack_height=0.42, stack_floor_z=-seat)
    room.printer = pr


def _droid(room, coll):
    x, y = ROOM['droid_start']
    # ten reams (+ the binder: its top at 0.72 m, table height) so the emptied trolley passes
    # under the table's overhang when it leaves the hand-off
    d = P.paper_droid('droid', coll, (x, y, 0.0), math.radians(ROOM['droid_start_heading']),
                      trail_offset=ROOM['droid_trail'], reams_high=10)
    room.droid = d


def _fills(room, coll):
    """Low ambient so the charcoal panels, the carpet and the chair silhouettes read."""
    x0, x1 = ROOM['interior_x']
    y0, y1 = ROOM['interior_y']
    fills = []
    for i, yy in enumerate((-26.0, -15.0, -4.0)):
        l = C.area_light(f'fill_{i}', (0.0, yy, 5.6), (0.0, yy, 0.0), 120.0 * LIGHT['fill'], 5.0, 9.0,
                         color=(0.85, 0.88, 1.0), coll=coll)
        l.data.size_y = 10.0
        l.data.spread = math.radians(60)
        l.visible_camera = False
        l.visible_glossy = False
        fills.append((l, l.data.energy))
    # neutral grazing wash on each long wall, only over its middle stretch: the near panels
    # (the frame edges of the foot wide) and the far ones fall off to blue-black, so the lit
    # table is the only figure
    for side in (-1, 1):
        # a long soft card 1.8 m off the wall at 3.2 m, facing it: an even low wash over the
        # panels' middle heights (no hot band under the ceiling), ending well before the foot
        l = C.area_light(f'wallwash_{side}', (side * (x1 - 1.8), LIGHT['wash_cy'], 3.2), None,
                         300.0 * LIGHT['wash'] * LIGHT['wash_span'] / 34.0, 0.8, color=(0.85, 0.88, 1.0), coll=coll)
        l.data.size_y = LIGHT['wash_span']
        l.data.spread = math.radians(100)
        aim_light(l, Vector((side * 1.0, 0.0, -0.18)))
        l.visible_camera = False
        l.visible_glossy = False
        fills.append((l, l.data.energy))
    # and a dimmer stretch near the head (y -7 .. 0): the panels behind him in the S07 /
    # S09 / S11 angles read as charcoal, not void (the foot end stays blue-black)
    for side in (-1, 1):
        span = 7.0
        l = C.area_light(f'wallwash_head_{side}', (side * (x1 - 1.8), -3.0, 3.2), None,
                         3.5 * 300.0 * LIGHT['wash'] * span / 34.0, 0.8, color=(0.85, 0.88, 1.0), coll=coll)
        l.data.size_y = span
        l.data.spread = math.radians(100)
        aim_light(l, Vector((side * 1.0, 0.0, -0.18)))
        l.visible_camera = False
        l.visible_glossy = False
        fills.append((l, l.data.energy))
    # the slab's bounce off the walnut: a faint warm-white strip under the ceiling that
    # lifts the carpet and the chair bases along the table (aimed down, narrow: it keeps off
    # the walls, which fall to blue-black)
    for side in (-1, 1):
        l = C.area_light(f'slab_bounce_{side}', (side * 1.6, ROOM['skylight_cy'], 3.2), None, 34.0, 0.9,
                         color=(1.0, 0.96, 0.92), coll=coll)
        l.data.size_y = ROOM['skylight_len']
        l.data.spread = math.radians(70)
        aim_light(l, Vector((side * 0.12, 0.0, -1.0)))
        l.visible_camera = False
        l.visible_glossy = False
        fills.append((l, l.data.energy))
    # the foot: a soft high downlight so the printer and the droid read in the dark
    # foreground of the wide. It skips the white paper (the trolley's reams, the binder, the
    # printer's floor stack), which would otherwise outshine the table: they keep only the
    # room's ambient and sit well under the subject
    l = C.area_light('foot_fill', (0.0, -31.0, 5.4), (0.6, -30.3, 0.4), 10.0 * LIGHT['foot'], 2.6, 1.6,
                     color=(0.9, 0.93, 1.0), coll=coll)
    l.data.spread = math.radians(62)               # a pool round the printer and the droid, not the floor's edges
    l.visible_camera = False
    l.visible_glossy = False
    paper = []
    if getattr(room, 'droid', None) is not None:
        paper += list(getattr(room.droid, 'reams', []))
        if room.droid.binder is not None:
            paper += _meshes(room.droid.binder)
    if getattr(room, 'printer', None) is not None:
        paper += _meshes(room.printer.stack)
    if paper:
        _unlink_light(l, paper, 'LR_foot_fill_excluded')
    room.foot_fill = l
    fills.append((l, l.data.energy))
    room.fills = fills


def aim_light(light, direction, along=(0.0, 1.0, 0.0)):
    """Point an area light along `direction` keeping its size_y axis along `along`."""
    z = -Vector(direction).normalized()
    y = Vector(along) - z * Vector(along).dot(z)
    y.normalize()
    x = y.cross(z)
    light.rotation_euler = Matrix((x, y, z)).transposed().to_euler()


def stand_in(coll, pos=SYNERGY_POS, room=None):
    """1.75 m grey stand-in for Synergy (cup in his RIGHT hand at chest height)."""
    grey = P.flat((0.16, 0.16, 0.165), 0.55)
    rt = P.root('synergy_placeholder', coll, pos, 0.0)
    parts = []
    bm = bmesh.new()
    P.bm_pillow(bm, 0.50, 0.30, 0.62, 0.10, 0.06, steps=3, seg=4, z0=0.78)
    parts.append(P.to_object(bm, 'ph_torso', [grey], coll, smooth=40.0, recalc=False))
    for sx in (-1, 1):
        parts.append(P.cylinder(f'ph_leg{sx}', 0.07, 0.80, (sx * 0.12, 0, 0.40), grey, coll, 16))
        parts.append(P.cylinder(f'ph_arm{sx}', 0.05, 0.60, (sx * 0.32, 0.0, 1.06), grey, coll, 16))
    parts.append(P.cylinder('ph_neck', 0.06, 0.12, (0, 0, 1.45), grey, coll, 16))
    head = P.box('ph_head', (0.45, 0.32, 0.30), (0, 0.0, 1.60), grey, coll, 0.03)
    head.rotation_euler = (0, math.radians(4), 0)
    parts.append(head)
    screen = P.box('ph_screen', (0.18, 0.01, 0.12), (0.03, -0.165, 1.60), P.flat((0.01, 0.012, 0.01), 0.08), coll, 0.004)
    parts.append(screen)
    for o in parts:
        o.parent = rt
    # forearm forward to the cup, cup in the right hand (-X) at chest height
    fa = P.cylinder('ph_forearm', 0.045, 0.30, (-0.30, -0.15, 1.12), grey, coll, 16, 'Y')
    fa.parent = rt
    cup = P.cup_and_lid('ph_cup', coll, (-0.22, -0.30, 1.22 - 0.065), 0.0, hero=room is not None)
    cup.root.parent = rt
    if room is not None:
        room.placeholder_cup = cup
    return rt


def build(placeholder=False, state='lit', cords=True, seat_yaw_deg=None, render_budget=False):
    """Build the whole Long Room into the current scene. Returns a Room handle.

    placeholder=True adds the 1.75 m grey stand-in for Synergy at SYNERGY_POS.
    seat_yaw_deg swivels the colleagues for this shot (default ROOM['seat_yaw_deg'];
    see SHOT_SEAT_YAW). render_budget=True (or a kind, 'wide'/'macro') applies the room's
    render settings (Room.render_budget); by default the scene's own settings are kept."""
    room = Room()
    room.seat_yaw = ROOM['seat_yaw_deg'] if seat_yaw_deg is None else seat_yaw_deg
    coll = C.collection('LongRoom')
    sub = {k: C.collection(f'LR_{k}', coll) for k in ('shell', 'table', 'seats', 'cords', 'props', 'head', 'printer',
                                                     'droid', 'lights')}
    _shell(room, sub['shell'])
    _ceiling_and_skylight(room, sub['lights'])
    _table(room, sub['table'])
    _link_light(room.sun_table, walnut_objects(room), 'LR_walnut_receivers')
    _seats(room, sub['seats'])
    _head(room, sub['head'])
    if cords:
        _cords(room, sub['cords'])
    _problem_props(room, sub['props'])
    _printer(room, sub['printer'])
    _droid(room, sub['droid'])
    _fills(room, sub['lights'])
    if placeholder:
        room.placeholder = stand_in(C.collection('Synergy_Placeholder'), room=room)
    room.set_state(1, state)
    room.compositor()
    if render_budget:
        room.render_budget(kind=render_budget if isinstance(render_budget, str) else 'wide')
    return room


# ================================================================== demo timeline + preview cameras

# S07 deferral machine (colleague, prop index, arrival frame on the beat, double time?)
S07_ARRIVALS = [('linda', 0, 609, False), ('keys', 0, 625, False), ('strategy', 0, 641, False),
                ('people', 0, 657, False), ('arjun', 0, 673, True), ('operations', 0, 681, True),
                ('synthia', 0, 689, True), ('strategy', 1, 697, True)]


def droid_handoff_path(lane=None, cy=None):
    """Plan path of the droid from its lane to the S07 hand-off: up the lane, a tight turn
    behind the head of the table (clear of the head wall: the trolley swings outside the
    turn) and back down beside his left hip to ROOM['droid_handoff'], facing the foot."""
    lane = ROOM['droid_lane_x'] if lane is None else lane
    hx, hy = ROOM['droid_handoff']
    cx, r = (lane + hx) / 2, (lane - hx) / 2
    cy = ROOM['droid_turn_y'] if cy is None else cy
    arc = [(cx + r * math.cos(math.pi * k / 8), cy + r * math.sin(math.pi * k / 8)) for k in range(0, 9)]
    return [(lane, -4.6), (lane, -2.0), (lane, cy - 0.5)] + arc + [(hx, cy - 0.3), (hx, hy)]


def droid_exit_path(lane=None):
    """Plan path of the droid backing out of the hand-off: exactly the way it came in,
    reversed (drive(..., reverse=True): it faces up-room and the trolley leads, retracing its
    own trail round the turn and into the lane, clear of the table, the plinth and the
    chairs), to park in its lane abreast of its empty bay (ROOM['droid_park_y'])."""
    lane = ROOM['droid_lane_x'] if lane is None else lane
    path = droid_handoff_path(lane)[1:][::-1]           # hand-off ... arc ... (lane, -2.0)
    return path + [(lane, ROOM['droid_park_y'])]


def demo_timeline(room):
    """The treatment's room events on the film timeline (used by previews; shots may copy it).

    State hand-overs the shots must honour (the room keys its own side of each):
      f300      the droid sets off up the camera-right lane (trolley 0.35 m outboard).
      f377-424  Kevin's padlock slides to the fingertip (S04).
      f433      S05 takes the padlock off the walnut: the room's copy is hidden from f433
                (the shot parents a padlock to the left hand from f433 and posts it).
      f609-712  S07: objects slide in on the beats, each hidden one cycle after it arrives;
                the droid makes its measured stop beside his left hip by f712.
      f721      he lifts the binder off the trolley (the shot's hand copy); the trolley's
                binder is hidden from f729, when the accordion squeeze into the slot starts.
      f737-985  the droid reverses out the way it came and parks back at the foot.
      f838-852  S09: the same padlock slides in again.
      f961      the jack pull; the master cord springs and settles on the walnut.
      f1001+    S11 shutdown wave; f1049 printer stops, the droid's pinlight goes out;
      f1053     dark state; f1085 Pat powers on; f1305-1344 the slab drifts (S13)."""
    pr = room.printer
    for f in (257, 321, 385, 449, 513, 577, 641, 705, 769, 833, 897):
        pr.feed(f)
    pr.led_pulse(1, 1048)
    pr.stop_mid(1049)
    pr.led_off(1049)
    d = room.droid
    d.blink(1, 1440, 48)
    lane = ROOM['droid_lane_x']
    x0, y0 = ROOM['droid_start']
    # waiting in its lane abreast of the foot; it sets off at f300 at a measured pace
    d.place(299, x0, y0, ROOM['droid_start_heading'])
    d.drive(300, 712, [(x0, y0), (x0, y0 + 1.2), (lane, -26.0), (lane, -8.0)] + droid_handoff_path(lane)[1:],
            ease='cruise', accel=0.04)
    # after the hand-off it reverses out the way it came (trolley leading), off screen
    # through S08-S10, and parks back at the foot before S11 (dark there from f1049)
    d.drive(737, 985, droid_exit_path(lane), reverse=True, ease='cruise', accel=0.06)
    d.light_off(1049)
    room.key_visible(d.binder, 729, False)
    T = room.terminals
    T['kevin'].speak(353, 377, seed=7)
    pad = room.props['kevin'][0]
    home = prop_home('kevin')
    stop = Vector(stop_for('padlock', obj=pad, start=home))
    P.slide(pad, 377, 424, home, tuple(stop), settle=0.0, accel=0.55)
    pad.keyframe_insert('location', frame=432)        # holds at the stop until he lifts it
    room.key_visible(pad, 433, False)                 # S05: in his hand from f433 (the shot's copy)
    # S07 deferral machine (flares + slides arriving on the beats); each object is posted
    # and gone by the end of its cycle
    for nm, f in (('linda', 609), ('keys', 625), ('strategy', 641), ('people', 657), ('arjun', 673),
                  ('operations', 681), ('synthia', 689), ('strategy', 697)):
        T[nm].flare(f - 16 if f - 16 > 600 else f - 8)
    T['people'].speak(645, 657, seed=3)
    T['strategy'].speak(629, 641, seed=5)
    tabs = room.props['strategy'][0]
    t0 = prop_home('strategy', 0)
    P.slide(tabs, 627, 641, t0, stop_for('tabs', obj=tabs, start=t0, yaw=tabs.rotation_euler.z), settle=0.0)
    env = room.props['people'][0]
    e0 = prop_home('people', 0)
    spin = 540.0
    P.slide(env, 643, 657, e0, stop_for('envelope', obj=env, start=e0, yaw=env.rotation_euler.z + math.radians(spin)),
            settle=0.0, spin_deg=spin)
    for nm, i, f, dbl in S07_ARRIVALS:
        room.key_visible(room.props[nm][i], f + (8 if dbl else 16), False)
    # S09 Kevin again: the same padlock slides in from down-table and stops on the beat
    T['kevin'].speak(833, 869, seed=7)
    dirn = (stop - Vector(home)).normalized()
    room.key_visible(pad, 838, True)
    P.slide(pad, 838, 852, tuple(stop - dirn * 1.6), tuple(stop), settle=0.0, accel=0.2)
    # S10 the jack pull on the downbeat: axial first (the pin clears the bore), then up and back
    j = room.jack.root
    base = Vector(j.location)
    j.keyframe_insert('location', frame=960)
    for f, (dy, dz) in ((961, (0.010, 0.0)), (962, (0.017, 0.004)), (963, (0.025, 0.018))):
        j.location = base + Vector((0.0, dy, dz))
        j.keyframe_insert('location', frame=f)
    room.master.pulled(961)
    room.hub.leds_off(961)
    # S11 the shutdown wave, the dark, Pat joins late
    room.shutdown_wave(1001)
    room.set_state(1053, 'dark')
    T['pat'].power_on(1085)
    # S13 the slab drifts as the room tilts
    room.sun_drift(1305, 1344, 0.20)


def _cam(name, lens, loc, target, fstop=0.0, focus=None, shift_y=0.0, roll=0.0, shift_x=0.0):
    cam = bpy.data.objects.get(name)
    if cam is None:
        cam = C.camera(name, lens, loc, target, fstop=fstop, focus=focus, clip=(0.005, 200.0))
    else:
        cam.location = loc
        C.look_at(cam, target)
    if roll:
        cam.rotation_euler.rotate_axis('Z', math.radians(roll))
    cam.data.shift_y = shift_y
    cam.data.shift_x = shift_x
    return cam


PREVIEW_YAW = {'s02_end': 's02', 's02_lid': 's02', 's03_wide': 's03', 's04_start': 's04', 's04_tabletop': 's04',
               's05_medium': 's05', 's07_profile_lane': 's07', 's09_low': 's09', 's10_jack_macro': 's10',
               's11_shutdown': 's11', 's11_pat': 's11', 's13_dark': 's13'}
# render_budget kind and insert kits per preview framing
PREVIEW_BUDGET = {'s04_start': 'macro', 's04_tabletop': 'macro', 's09_low': 'macro', 's10_jack_macro': 'macro',
                  's02_end': 'macro', 's02_lid': 'macro', 's05_medium': 'macro'}
PREVIEW_KITS = {'s04_start': ('padlock',), 's04_tabletop': ('padlock',), 's09_low': ('padlock',),
                's10_jack_macro': ('jack',), 's13_dark': ('sip',), 's02_lid': ('lid',), 'macro_zero': ('zero',)}
# view exposure per framing (stops): the S02 opening lid sits in the sun slab, a white lid
# filling the frame; the shot keys this back to 0 over its pull-back to him
PREVIEW_EXPOSURE = {'s02_lid': -1.0}
# framings whose camera is locked off in the film (fixed sampling seed, see Room.render_budget)
PREVIEW_LOCKED = ('s05_medium', 's09_low', 's10_jack_macro', 's11_shutdown', 's11_pat', 's13_dark')
MACRO_PROPS = ('padlock', 'envelope', 'tabs', 'binder', 'zero')


def _macro_props(room):
    """Hero copies of the problem props on the walnut inside the slab near the foot, for
    100 mm macro judgement under the room's own light (built once, hidden otherwise)."""
    if getattr(room, 'macro_set', None):
        return room.macro_set
    coll = C.collection('LR_macro_props', C.collection('LongRoom'))
    tz = TABLE_TOP
    y = -21.5                                   # inside the slab (it lands on the walnut from y -26.7 up)
    objs = {
        'padlock': P.padlock('mac_padlock', coll, (0.18, y, tz), math.radians(64)),
        'envelope': P.envelope('mac_envelope', coll, (0.20, y - 1.0, tz), math.radians(68), seed=4),
        'tabs': P.tab_stack('mac_tabs', coll, (0.20, y - 2.0, tz), math.radians(-24)),
        'binder': P.binder('mac_binder', coll, (0.24, y - 3.1, tz), math.radians(-14)),
        'zero': P.glass_zero('mac_zero', coll, (0.20, y - 4.3, tz)),
    }
    room.macro_set = (coll, objs)
    return room.macro_set


def _stand_in_cup(room):
    """The stand-in's cup (props.Cup; the S02 lid macro aims at its slot), or None."""
    return getattr(room, 'placeholder_cup', None)


def preview_camera(room, name):
    """(frame, camera) for the treatment framings used by tools/preview_room.py.
    Swivels the chairs to the shot's SHOT_SEAT_YAW first, and shows only the insert kits
    the framing uses (PREVIEW_KITS)."""
    sc = bpy.context.scene
    tz = ROOM['table_top_z']
    shot = PREVIEW_YAW.get(name)
    room.cord_mode = SHOT_CORDS.get(shot, 'flush') if shot else 'flush'      # applied by the rebuild below
    if shot is not None and (abs(room.seat_yaw - SHOT_SEAT_YAW[shot]) > 1e-6 or
                             getattr(room, '_built_cord_mode', 'flush') != room.cord_mode):
        room.set_seat_yaw(SHOT_SEAT_YAW[shot])
    for kit in PREVIEW_KITS.get(name, ()):
        if kit == 'padlock':
            room.insert_lights('padlock', target=room.props['kevin'][0])
        elif kit == 'zero' and name.startswith('macro_'):
            room.insert_lights('zero', target=_macro_props(room)[1]['zero'])
        else:
            room.insert_lights(kit)
    room.use_kits(*PREVIEW_KITS.get(name, ()))
    mset = getattr(room, 'macro_set', None)
    if mset:
        mset[0].hide_render = not name.startswith('macro_')
    room.hide_far_room(False)
    for o in getattr(room, 'bokeh', []):
        o.hide_render = True
    if getattr(room, 'mirror', False):
        room.head_mirror(False)
    sp = Vector(SYNERGY_POS)
    if name == 's03_wide':
        # level camera on the axis behind the foot (the foot wall is hidden), shifted down for
        # rigid one-point verticals: 50 mm, so the walls converge out of the frame edges and
        # the lit table, the nine screens and the host are the figure. The frame top stops
        # under the ceiling: the slot is never a tangent fragment, its slab and its glint in
        # the brass carry it. The printer on its chair is the soft lower foreground (f/4,
        # focused at 18 m); the droid sets off up the camera-right lane. 1.5 m push.
        room.hide_from_camera('foot')
        f = 300
        cam = bpy.data.objects.get('cam_s03') or C.camera('cam_s03', 50.0, (0, -39.0, 2.6), None, fstop=4.0,
                                                           focus=18.0, clip=(0.05, 200.0))
        cam.rotation_euler = (math.pi / 2, 0.0, 0.0)
        cam.data.lens = 50.0
        cam.data.shift_y = -0.175
        cam.data.dof.use_dof = True
        cam.data.dof.aperture_fstop = 4.0
        cam.data.dof.focus_distance = 18.0
        for fr, yy in ((257, -39.0), (352, -37.5)):
            cam.location = (0.0, yy, 2.6)
            cam.keyframe_insert('location', frame=fr)
        for fc in C.fcurves(cam.animation_data.action):
            for kp in fc.keyframe_points:
                kp.interpolation = 'BEZIER'
                kp.easing = 'EASE_OUT'
        return f, cam
    if name in ('s04_start', 's04_tabletop'):
        # lens 3 cm above the walnut, 0.5 m from the padlock with Kevin's CRT 1.5 m behind it
        room.hide_from_camera()
        f = 364 if name == 's04_start' else 390
        pad = room.props['kevin'][0]
        home = Vector((*prop_home('kevin'), tz))
        crt = room.terminals['kevin'].to_world((0.0, P.CRT['front'], P.CRT['zs']))
        d = (Vector((home.x, home.y, 0)) - Vector((crt.x, crt.y, 0))).normalized()
        off = d * 0.5 + Vector((0, 0, 0.03))
        aim = Vector((crt.x * 0.55 + home.x * 0.45, crt.y * 0.55 + home.y * 0.45, tz + 0.06)) - home
        cam = _cam(f'cam_{name}', 40.0, tuple(home + off), tuple(home + aim), fstop=2.8, focus=0.5)
        foc = bpy.data.objects.get(f'focus_{name}') or C.empty(f'focus_{name}', None, tuple(home + Vector((0, 0, 0.035))))
        cam.data.dof.focus_object = foc
        if name == 's04_tabletop':
            # ride beside the padlock: camera and focus keyed every frame with LINEAR keys
            # (the slide's own interpolation), so motion blur sees the padlock still in frame
            for fr in range(f - 3, f + 4):
                sc.frame_set(fr)
                p = pad.matrix_world.translation.copy()
                cam.location = p + off
                cam.keyframe_insert('location', frame=fr)
                foc.location = p + Vector((0, 0, 0.035))
                foc.keyframe_insert('location', frame=fr)
            for o in (cam, foc):
                for fc in C.fcurves(o.animation_data.action):
                    for kp in fc.keyframe_points:
                        kp.interpolation = 'LINEAR'
        return f, cam
    if name == 's05_medium':
        # S05: 85 mm f/2 at screen height, 2.6 m away, 10 deg to his right; colour bokeh
        # behind him from Room.front_bokeh
        room.hide_from_camera()
        f = 470
        a = math.radians(10)
        loc = (sp.x - 2.6 * math.sin(a), sp.y - 2.6 * math.cos(a), 1.58)
        cam = _cam('cam_s05', 85.0, loc, (sp.x, sp.y, 1.42), fstop=2.0, focus=2.6)
        room.front_bokeh(cam, f)
        return f, cam
    if name == 's07_profile_lane':
        # From his LEFT, down-table and outboard, 24 mm, looking back across him: he stands
        # at frame right in three-quarter (face screen ~54 deg to the lens, LEDs readable),
        # the table and its terminals recede frame left (the treatment's composition), and
        # the droid's measured stop with the binder at his left hip is in the foreground
        # (f712). From his right the table hides the droid entirely (its dome is 0.2 m below
        # the walnut), so the camera crosses to the droid's side; the cup sits on his far
        # side. NOTE for the director: no frame that reads his face (screen <= 66 deg to the
        # lens) can also hold more than one terminal screen (Synthia's): the rest sit more
        # than 55 deg off his line of sight; the flares reach him as coloured rim light.
        room.hide_from_camera('head')
        f = 712
        loc = Vector((2.85, -1.75, 1.72))
        yaw, pitch = math.radians(163.0), math.radians(-13.0)
        tgt = loc + Vector((math.cos(yaw) * math.cos(pitch), math.sin(yaw) * math.cos(pitch), math.sin(pitch)))
        cam = _cam('cam_s07', 26.0, tuple(loc), tuple(tgt), fstop=5.6, focus=3.1)
        return f, cam
    if name == 's09_low':
        # lens 6 cm above the walnut, 0.9 m down-table from his stop point, looking back up
        # at him; 24 mm, so the padlock (bottom, sharp) and his face looking down (top) share
        # the frame (a 40 mm frame cannot hold both from 0.9 m: they span ~38 deg); the hub
        # stays out of frame left
        room.hide_from_camera('head')
        f = 870
        sx, sy = stop_for('padlock')
        loc = Vector((sx + 0.22, sy - 0.88, tz + 0.06))
        cam = _cam('cam_s09', 24.0, tuple(loc), (sx - 0.14, SYNERGY_POS[1], 0.81 + 1.30 * math.tan(math.radians(15.5))),
                   fstop=2.8)
        foc = bpy.data.objects.get('focus_s09') or C.empty('focus_s09', None, (sx, sy, tz + 0.03))
        cam.data.dof.focus_object = foc
        return f, cam
    if name == 's10_jack_macro':
        # from beyond the head edge (between the table and him), 100 mm at 0.44 m, the lens
        # 3 cm above the walnut looking back along the master cord (shifted down): the socket
        # and the knurled jack in the lower third, the cord rising over the edge to the soft
        # hub, and over the walnut's horizon the slab and its dust
        room.hide_from_camera()
        room.hide_far_room(True)
        f = 950
        s_ = Vector(ROOM['socket_pos']) + Vector((0.0, P.SOCKET_FACE, 0.0))
        dh = Vector((0.40, 0.92, 0.0)).normalized()
        loc = s_ + dh * 0.44
        loc.z = TABLE_TOP + 0.030
        tgt = s_ - dh * 0.30 + Vector((0.0, 0.0, 0.030))
        foc = bpy.data.objects.get('focus_s10') or C.empty('focus_s10', None, tuple(s_ + Vector((0, 0.016, 0.0))))
        cam = _cam('cam_s10', 100.0, tuple(loc), tuple(tgt), fstop=5.6, focus=foc)
        cam.data.dof.focus_object = foc
        cam.data.shift_y = -0.125
        return f, cam
    if name in ('s11_shutdown', 's11_pat'):
        # behind-left of him (1.4 m to his left, 1.8 m behind, 1.6 m up), 32 mm, panned 20 deg
        # across the table: his whole silhouette at frame right, every shutdown screen and
        # Pat clear of a 0.75 m silhouette (tools/preview_room.py checks the projection); tilted
        # 10.5 deg down so the frame top stops under the slot's far end (no tube-like stub: the
        # slab on the walnut and the brass carries the skylight here)
        room.hide_from_camera('head')
        f = 1030 if name == 's11_shutdown' else 1110
        loc = Vector((sp.x + 1.4, sp.y + 1.8, 1.60))
        a = math.radians(20.0)
        tgt = loc + Vector((-math.sin(a), -math.cos(a), -math.tan(math.radians(10.5)))) * 10.0
        cam = _cam(f'cam_{name}', 32.0, tuple(loc), tuple(tgt), fstop=5.6, focus=2.3)
        return f, cam
    if name == 's13_dark':
        room.hide_from_camera()
        f = 1300
        a = math.radians(8)
        loc = (sp.x - 1.9 * math.sin(a), sp.y - 1.9 * math.cos(a), 1.35)
        cam = _cam('cam_s13', 65.0, loc, (sp.x, sp.y, 1.42), fstop=2.8, focus=1.9)
        room.front_bokeh(cam, f)            # in the dark only Pat's grey disc is alive
        return f, cam
    if name == 's02_end':
        # the S02 end position (2.1 m in front, screen height, 10 deg to his right, 65 mm
        # f/2): the colleagues glow behind him as colour discs (Room.front_bokeh)
        room.hide_from_camera()
        f = 250
        a = math.radians(10)
        loc = (sp.x - 2.1 * math.sin(a), sp.y - 2.1 * math.cos(a), 1.58)
        cam = _cam('cam_s02_end', 65.0, loc, (sp.x, sp.y, 1.50), fstop=2.0, focus=2.1)
        room.front_bokeh(cam, f)
        return f, cam
    if name == 's02_lid':
        # the S01 -> S02 match cut: 100 mm, straight down on the lid, the sip slot centred,
        # its long axis horizontal, 20% of the frame width (0.21 m up: the treatment's 26 cm
        # gives 16% with a 15 mm slot); the 'lid' kit rakes the embossed rings and the spout
        room.hide_from_camera()
        f = 140
        cup = _stand_in_cup(room)
        bpy.context.view_layer.update()
        slot = cup.slot.matrix_world.translation.copy() if cup is not None else sp + Vector((-0.22, -0.26, 1.29))
        w_slot = P.CUP['slot_len']
        dist = w_slot / 0.20 * 100.0 / 36.0
        cam = _cam('cam_s02_lid', 100.0, tuple(slot + Vector((0.0, 0.0, dist))), tuple(slot), fstop=4.0, focus=dist)
        cam.rotation_euler = (0.0, 0.0, 0.0)
        return f, cam
    if name.startswith('macro_'):
        kind = name[len('macro_'):]
        coll, objs = _macro_props(room)
        coll.hide_render = False
        room.hide_from_camera()
        f = 300
        o = objs[kind]
        bpy.context.view_layer.update()
        c = o.matrix_world.translation.copy()
        dist = {'padlock': 0.42, 'envelope': 0.75, 'tabs': 0.52, 'binder': 0.95, 'zero': 0.55}[kind]
        lift = {'padlock': 0.03, 'envelope': 0.0, 'tabs': 0.004, 'binder': 0.04, 'zero': 0.012}[kind]
        aim = c + Vector((0.0, 0.0, lift))
        d = Vector((0.75, -0.45, 0.62)).normalized()
        cam = _cam(f'cam_{name}', 100.0, tuple(aim + d * dist), tuple(aim), fstop=5.6, focus=dist)
        return f, cam
    raise KeyError(name)
