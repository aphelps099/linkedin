"""E2_LONG_ROOM: the 34 m boardroom around the 30 m walnut table (and E3 inserts' set).

    import env_room as R
    room = R.build(placeholder=True, seat_yaw_deg=R.SHOT_SEAT_YAW['s03'])
    room.render_budget(kind='wide')        # opt in: the room's measured render settings
    room.terminals['kevin'].speak(353, 376)
    pad = room.props['kevin'][0]
    P.slide(pad, 377, 424, R.prop_home('kevin'), R.stop_for('padlock', obj=pad))
    room.key_visible(pad, 519, False)      # posted through the slot: gone (and its insert card)
    room.shutdown_wave(1001)               # S11 order, a screen every 5 frames
    room.set_state(1053, 'dark')
    room.tune_scanlines(cam)               # moire-safe CRT scanlines for this lens
    room.compositor()                      # house look: glare, mist, vignette

Coordinates are fixed (shots depend on them) and exported in ROOM / SEATS:
metres, Z up, floor z=0, the table runs from its foot (y=-30) to its head edge
(y=0), and Synergy stands at SYNERGY_POS facing -Y (his right is -X).
One 6500K sun lays a hard 0.75 m slab down the table spine through a rounded-slot
skylight; each CRT pools its colour on the glossy walnut through its own area
light, and a glossy-only card per live screen streaks that colour down the coat.
No volumetrics: depth haze comes from the compositor mist pass.

Cords: each terminal's yellow coiled cord drops from the CRT, loops under the
table edge, runs beneath the walnut and rises through a grommet into the brass
channel at its own seat, then runs in its own lane to the hub. The walnut
surface stays clear, so every prop home and slide lane is free of cords, and the
channel fills with yellow toward the host.

Per-shot chair swivel: terminals face the host by default (seat_yaw_deg); shots
that look up-table from the foot swivel them toward the camera
(build(seat_yaw_deg=...) or room.set_seat_yaw(deg); SHOT_SEAT_YAW has the values).

Insert light kits (room.insert_lights('jack' | 'padlock' | 'sip')) each live in their
own collection; room.use_kits('jack') shows one kit and hides the others.
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
    droid_start=(1.5, -30.4),               # parked across the lane beside the foot, facing +X (heading below)
    droid_start_heading=-90.0,              # degrees, props.Droid convention (0 faces +Y, -90 faces +X)
    droid_bay=(1.15, -3.0),
    skylight_len=28.4, skylight_w=0.75, skylight_cy=-13.6, skylight_depth=0.9,   # slot y -27.8 .. +0.6
    mullion_pitch=2.6,                      # 20 mm glazing bars, barely darker than the glass
    sun_tilt_deg=10.0,                      # light travels toward +Y: the slab reaches over the host
    prop_x=0.50,                            # problem props sit this far off the spine
    # Synergy's left index fingertip resting on the walnut: the reach_L contract (synergy.py
    # REACH_L_TIP) puts the END of the index tip, its down-table surface, here. stop_for()
    # measures the sliding object itself and can take a measured tip (measure_tip) instead.
    fingertip_L=(0.29, -0.09, 0.755),
    stop_L=(0.29, -0.108),                  # the hero padlock's stop against the contract tip (stop_for('padlock'))
    streak_x=0.55, streak_z=0.95,           # walnut-streak cards: over the table, inboard of each terminal (head end)
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

LIGHT = dict(sun=6.5, sun_angle=0.35, diffuser=1.9, fill=0.07, crt=6.5, wash=0.07, pat=40.0, foot=6.0,
             streak=0.8, streak_len=12.0, streak_w=0.11, wash_span=15.0, wash_cy=-12.0)

CORD_RC = 0.0042 + 0.0013                  # coil outer radius
# half-depth of each problem object along its slide (the padlock turned 8 deg, broad face down-table)
STOP_HALF = {'padlock': 0.0160, 'envelope': 0.012, 'tabs': 0.025, 'glass_zero': 0.064, 'binder': 0.15}

# Room-level render settings per kind of framing (Room.render_budget). 'final' clamps the
# samples only when no explicit --samples override was given; 'hero' is never clamped.
BUDGET = {
    # (max_bounces only caps transmission chains: three stacked acrylic tabs or the glass zero
    # need 6-8 interfaces, diffuse and glossy are capped on their own)
    'wide': dict(max_bounces=8, diffuse=2, glossy=2, transmission=8, transparent=6, volume=0,
                 threshold=0.06, min_samples=6, final_spp=12),
    'macro': dict(max_bounces=8, diffuse=1, glossy=2, transmission=8, transparent=4, volume=0,
                  threshold=0.08, min_samples=6, final_spp=9),       # 9 spp: mean abs diff 0.55/255 vs 12
}


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


def stop_for(kind='padlock', obj=None, tip=None, start=None, gap=None, hand=None):
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
    against the contract point."""
    if gap is None:              # the contract tip ignores the finger's rounded cap: keep clear of it
        gap = 0.0015 if (hand or tip is not None) else 0.003
    fx, fy = (ROOM['fingertip_L'][0], ROOM['fingertip_L'][1] - FINGER_R) if tip is None else (tip[0], tip[1])
    if obj is None:
        return fx, fy - gap - STOP_HALF.get(kind, 0.02)
    pts = _world_points(obj)
    origin = obj.matrix_world.translation
    o2 = Vector((origin.x, origin.y))
    rel = [Vector((p.x, p.y)) - o2 for p in pts]
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
        s = self.sun
        s.rotation_euler = self.sun_rot
        s.keyframe_insert('rotation_euler', frame=f0)
        h = TABLE_TOP
        ang = math.atan2(dx, ROOM['interior_z'][1] - h)
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
                out['dust'] = P.dust_motes('ins_dust', coll, center=(0.18, 0.10, 0.95), size=(0.5, 0.24, 0.30), n=120,
                                           cache_dir=cache_dir, radius=(0.0004, 0.0009))
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
    def render_budget(self, scene=None, still=False, samples=None, kind='wide', tier=None):
        """Room-level render settings (opt in; build() no longer applies them).

        kind 'wide' (S03/S07/S11/S13): short bounce chains (the coat is a 2-bounce mirror),
        adaptive stopping at 0.06; 'macro' (S04/S09/S10 inserts at f/2.8-4): max 3 bounces,
        1 diffuse, adaptive 0.08 with at least 8 samples. Uniform light picking for both.
        Sample clamps apply at the 'final' tier only and never to an explicit sample count
        (`samples`, or a scene count that differs from the tier's default); 'hero' and the
        preview tiers keep their samples. Calling it again with another kind first restores
        the scene's own settings. Prints the effective settings."""
        sc = scene or bpy.context.scene
        cy = sc.cycles
        if self._budget_base is None:
            self._budget_base = dict(samples=cy.samples, threshold=cy.adaptive_threshold,
                                     min_samples=cy.adaptive_min_samples, blur=sc.render.use_motion_blur,
                                     dq=getattr(cy, 'denoising_quality', None), pre=cy.denoising_prefilter)
        base = self._budget_base
        cy.samples = base['samples']
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
        elif tier not in ('hero',):
            cy.adaptive_threshold = max(cy.adaptive_threshold, b['threshold'] if kind == 'macro' else 0.0)
        cy.adaptive_min_samples = min(cy.adaptive_min_samples, cy.samples)
        if still:
            sc.render.use_motion_blur = False
        print(f'RENDER BUDGET kind={kind} tier={tier} spp={cy.samples} adaptive={cy.adaptive_threshold:.3f} '
              f'min={cy.adaptive_min_samples} bounces={cy.max_bounces}/{cy.diffuse_bounces}/{cy.glossy_bounces} '
              f'denoise={getattr(cy, "denoising_quality", "-")}/{cy.denoising_prefilter} blur={sc.render.use_motion_blur}',
              flush=True)
        return sc

    def compositor(self, glare=0.35, mist_amount=0.55, vignette=0.25):
        """House look: fog-glow glare, mist-pass depth haze, a soft vignette. Built on
        common.compositor, with the vignette's mask blurred by a recursive (fast) Gaussian
        instead of a 560 px convolution, and the glare at medium quality: the same look for
        a fraction of the compositing cost."""
        nt = C.compositor(glare=glare, glare_threshold=0.9, glare_size=8, vignette=vignette,
                          mist=dict(color=(0.006, 0.008, 0.016), start=6.0, depth=46.0, amount=mist_amount,
                                    falloff='LINEAR'))
        for n in nt.nodes:
            if n.type == 'BLUR':
                n.filter_type = 'FAST_GAUSS'
            elif n.type == 'GLARE':
                n.quality = 'MEDIUM'
        return nt


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
    """Where a colleague's cord rises into the channel: abreast of the seat, whatever
    the swivel (the cord's drop to the table edge follows the chair). His-left grommets
    sit 0.12 m further up so facing pairs never share a slot."""
    side, y = SEATS[name]
    return y + 0.05 + (0.12 if side > 0 else 0.0)


def _table(room, coll):
    tz, bz = ROOM['table_top_z'], ROOM['table_bottom_z']
    ya, yb = ROOM['table_y']
    hw = ROOM['table_half_w']
    # cross-section (x, z): square top edge, slim undercut chamfer below
    sec = [(-hw, tz), (-hw, bz + 0.02), (-hw + 0.035, bz), (hw - 0.035, bz), (hw, bz + 0.02), (hw, tz)]
    bm = bmesh.new()
    a = P.bm_ring(bm, [(x, ya, z) for x, z in sec])
    b = P.bm_ring(bm, [(x, yb, z) for x, z in sec])
    P.bm_bridge(bm, a, b, 0)
    P.bm_cap(bm, a, 0)
    P.bm_cap(bm, b, 0, flip=True)
    top = P.to_object(bm, 'table_top', [P.walnut()], coll, smooth=30.0)
    # cutters: the rounded-slot cable channel down the spine, a cord bore under each seat's
    # grommet, and the socket bore in the head edge (one exact boolean on a collection)
    cut_coll = bpy.data.collections.new('LR_table_cutters')
    c0, c1 = ROOM['channel_y']
    cw, cd = ROOM['channel_width'], ROOM['channel_depth']
    cut = [(-y, x) for x, y in P.stadium(c1 - c0, cw + 0.003, 24)]
    cut = [(x, y + (c0 + c1) / 2) for x, y in cut]
    bm = bmesh.new()
    P.bm_prism(bm, cut, tz - cd, tz + 0.05)
    cutter = P.to_object(bm, 'table_channel_cutter', [], cut_coll)
    room.bores = {}
    for name in TERMINALS:
        yg = _grommet_y(name)
        room.bores[name] = yg
        bm = bmesh.new()
        sl = [(-y, x) for x, y in P.stadium(0.064, 0.018, 8)]
        sl = [(x + LANES[name], y + yg + 0.019) for x, y in sl]
        P.bm_prism(bm, sl, bz - 0.02, tz - cd + 0.002)
        P.to_object(bm, f'table_bore_{name}', [], cut_coll)
    sx, sy, sz = ROOM['socket_pos']
    hole = P.cylinder('table_socket_bore', 0.0046, 0.03, (sx, sy, sz), None, cut_coll, 24, 'Y')
    for o in cut_coll.objects:
        o.hide_render = True
        o.hide_viewport = True
    bo = top.modifiers.new('Cutters', 'BOOLEAN')
    bo.operation = 'DIFFERENCE'
    bo.solver = 'EXACT'
    bo.operand_type = 'COLLECTION'
    bo.collection = cut_coll
    P.soft_bevel(top, 0.0025, 3, 30)
    room.table = top
    room.table_cutters = cut_coll
    # brass liner: the walls and a flush lip (the floor is the walnut, so each cord's
    # grommet opens through it). The lip is polished along the channel (its own material,
    # UV u down the table: one narrow, paler glint line each side of the yellow bundle);
    # the walls are aged dark.
    inner = [(-y, x) for x, y in P.stadium(c1 - c0, cw, 24)]
    inner = [(x, y + (c0 + c1) / 2) for x, y in inner]
    lip = [(-y, x) for x, y in P.stadium(c1 - c0 + 0.010, cw + 0.010, 24)]
    lip = [(x, y + (c0 + c1) / 2) for x, y in lip]
    bm = bmesh.new()
    r_lip = P.bm_ring(bm, [(x, y, tz + 0.0004) for x, y in lip])
    r_top = P.bm_ring(bm, [(x, y, tz + 0.0004) for x, y in inner])
    r_in = P.bm_ring(bm, [(x, y, tz - 0.0015) for x, y in inner])
    r_bot = P.bm_ring(bm, [(x, y, tz - cd + 0.0002) for x, y in inner])
    P.bm_bridge(bm, r_lip, r_top, 0)
    P.bm_bridge(bm, r_top, r_in, 2)
    P.bm_bridge(bm, r_in, r_bot, 1)
    uvl = bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        for lp in f.loops:
            lp[uvl].uv = (lp.vert.co.y, lp.vert.co.x + lp.vert.co.z)
    liner = P.to_object(bm, 'brass_channel', [P.brass('lip'), P.brass('aged'), P.brass('brushed')], coll, smooth=35.0,
                        recalc=False)
    room.channel = liner
    # grommets: a black rubber stadium ring round each bore, on the channel floor
    gbm = bmesh.new()
    for name in TERMINALS:
        yg = room.bores[name]
        outer = P.resample_closed([(-y, x) for x, y in P.stadium(0.069, 0.0235, 8)], 40)
        innr = P.resample_closed([(-y, x) for x, y in P.stadium(0.064, 0.0180, 8)], 40)
        ox, oy = LANES[name], yg + 0.019
        zf = tz - cd
        a = P.bm_ring(gbm, [(x + ox, y + oy, zf + 0.00005) for x, y in outer])      # flush: cords pass over it
        b = P.bm_ring(gbm, [(x + ox, y + oy, zf + 0.00005) for x, y in innr])
        c = P.bm_ring(gbm, [(x + ox, y + oy, zf - 0.002) for x, y in innr])
        d = P.bm_ring(gbm, [(x + ox, y + oy, zf - 0.0008) for x, y in outer])
        P.bm_bridge(gbm, a, b, 0)
        P.bm_bridge(gbm, b, c, 0)
        P.bm_bridge(gbm, d, a, 0)
    room.grommets = P.to_object(gbm, 'cord_grommets', [P.rubber()], coll, smooth=40.0)
    # plinth: a recessed black monolith under the slab, its top dropped to leave a cable
    # cavity under the walnut
    pw = ROOM['plinth_half_w']
    p0, p1 = ROOM['plinth_y']
    ptop = ROOM['plinth_top_z']
    plinth = P.box('table_plinth', (2 * pw, p1 - p0, ptop - 0.06), (0, (p0 + p1) / 2, (ptop - 0.06) / 2 + 0.06),
                   P.lacquer_black(), coll, 0.004)
    toe = P.box('table_plinth_toe', (2 * pw - 0.08, p1 - p0 - 0.08, 0.06), (0, (p0 + p1) / 2, 0.03),
                P.flat((0.002, 0.002, 0.002), 0.7), coll)
    room.plinth = plinth
    return top


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
        e = 22.0 * LIGHT['crt'] * min(2.2, 0.45 / max(P._luma(rgb), 0.2) ** 0.5)
        t = P.crt_terminal(name, P.TERMINAL_HEX[name], coll, tuple(mw.translation), rot,
                           powered=(name != 'pat'), energy=LIGHT['pat'] if name == 'pat' else e)
        room.terminals[name] = t
        # its streak in the walnut: a glossy-only card over the table, inboard of the screen
        # (long, so its mirror image spans metres of walnut; alternate seats sit 6 cm in or
        # out, so a tail never runs under its neighbour's card, and each card is 1 cm lower
        # than the next one up-table, so an overlapping tail never hides a bright head)
        k = [n for n, (sd, _) in sorted(SEATS.items(), key=lambda it: -it[1][1]) if sd == side].index(name)
        sx = side * (ROOM['streak_x'] + (0.06 if k % 2 == 0 else -0.06))
        room.streaks[name] = P.crt_streak_card(t, f'streak_{name}', coll,
                                               (sx, y, ROOM['streak_z'] + 0.002 * y),
                                               size=(LIGHT['streak_w'], LIGHT['streak_len']), gain=LIGHT['streak'],
                                               head=0.6)


def _cord_points(room, name):
    """Centreline of a terminal's cord: out of the CRT, over the seat edge, a soft sag,
    under the table edge, along the cable cavity beneath the walnut, up through its
    grommet bore into the channel, then along its lane to the hub."""
    side, y = SEATS[name]
    yaw = room.seat_yaw
    m = _terminal_matrix(name, yaw)
    tz, bz = ROOM['table_top_z'], ROOM['table_bottom_z']
    hw = ROOM['table_half_w']
    lane = LANES[name]
    cz = tz - ROOM['channel_depth'] + CORD_RC + 0.0004
    zc = bz - 0.045                              # run in the cavity under the walnut (plinth top 0.60)
    s = side
    ex = m @ (Vector(P.CRT['cord_exit']) + Vector((0.0, 0.0085, 0.0)))     # just out of the CRT's grommet
    p1 = m @ Vector((0.0, 0.215, 0.012))
    p2 = m @ Vector((0.01, 0.262, -0.02))
    yg = room.bores[name]
    edge_x = s * (hw - 0.03)
    sag_x = (p2.x + s * hw) / 2
    pts = [
        ex, p1, p2,
        Vector((sag_x, (p2.y + yg) / 2, 0.40)),
        Vector((s * (hw + 0.05), yg, 0.56)),
        Vector((edge_x, yg, zc)),
        Vector((s * (hw - 0.20), yg, zc)),
        Vector((s * 0.45, yg, zc)),
        Vector((lane + s * 0.045, yg, zc)),
        Vector((lane + s * 0.006, yg, zc + 0.022)),
        Vector((lane, yg, bz - 0.004)),
        Vector((lane, yg, bz + 0.03)),
        Vector((lane, yg + 0.004, cz - 0.016)),
        Vector((lane, yg + 0.020, cz - 0.001)),
        Vector((lane, yg + 0.045, cz)),
        Vector((lane, yg + 0.12, cz)),
        Vector((lane, _cord_end_y(lane), cz)),
    ]
    return pts


def _cord_end_y(lane):
    """Where a lane's cord ends: against the channel's rounded head end, under the hub."""
    r = ROOM['channel_width'] / 2
    w = min(r - 0.0005, abs(lane) + CORD_RC + 0.0012)
    return ROOM['channel_y'][1] - r + math.sqrt(r * r - w * w) - 0.0035


def _cords(room, coll):
    mat = P.cord_plastic()
    for name in TERMINALS:
        pts = _cord_points(room, name)
        dense = P.catmull(pts[:-1], 8) + [pts[-1]]
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
    room.master = P.master_cord(hub.port, jack.root, jack.tail_local, mids, 'master_cord', coll, turns=92)


def master_cord_mids(socket_pos, tz, origin=(0.0, 0.0, 0.0)):
    """Free control points of the master cord: across the walnut from the hub, over the
    head edge, then down and round to the jack's tail. `origin` offsets the layout."""
    o = Vector(origin)
    sx, sy, sz = socket_pos
    rc = 0.0055
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
    d = P.paper_droid('droid', coll, (x, y, 0.0), math.radians(ROOM['droid_start_heading']))
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
        l = C.area_light(f'wallwash_{side}', (side * (x1 - 0.7), LIGHT['wash_cy'], 5.85), None,
                         300.0 * LIGHT['wash'] * LIGHT['wash_span'] / 34.0, 0.4, color=(0.85, 0.88, 1.0), coll=coll)
        l.data.size_y = LIGHT['wash_span']
        l.data.spread = math.radians(60)
        aim_light(l, Vector((side * 1.0, 0.0, -1.3)))
        l.visible_camera = False
        l.visible_glossy = False
        fills.append((l, l.data.energy))
    # the slab's bounce off the walnut: a faint warm-white strip under the ceiling that
    # lifts the carpet and the chair bases along the table
    for side in (-1, 1):
        l = C.area_light(f'slab_bounce_{side}', (side * 1.6, ROOM['skylight_cy'], 3.2), None, 60.0, 0.9,
                         color=(1.0, 0.96, 0.92), coll=coll)
        l.data.size_y = ROOM['skylight_len']
        aim_light(l, Vector((side * 0.35, 0.0, -1.0)))
        l.visible_camera = False
        l.visible_glossy = False
        fills.append((l, l.data.energy))
    # the foot: a soft high downlight so the printer, its stack and the droid's start
    # read in the dark foreground of the wide
    l = C.area_light('foot_fill', (0.0, -31.0, 5.4), (0.4, -30.8, 0.4), 10.0 * LIGHT['foot'], 2.6, 1.6,
                     color=(0.9, 0.93, 1.0), coll=coll)
    l.visible_camera = False
    l.visible_glossy = False
    fills.append((l, l.data.energy))
    room.fills = fills


def aim_light(light, direction, along=(0.0, 1.0, 0.0)):
    """Point an area light along `direction` keeping its size_y axis along `along`."""
    z = -Vector(direction).normalized()
    y = Vector(along) - z * Vector(along).dot(z)
    y.normalize()
    x = y.cross(z)
    light.rotation_euler = Matrix((x, y, z)).transposed().to_euler()


def stand_in(coll, pos=SYNERGY_POS):
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
    cup = P.cup_and_lid('ph_cup', coll, (-0.22, -0.30, 1.22 - 0.065), 0.0, hero=False)
    cup.root.parent = rt
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
    _seats(room, sub['seats'])
    _head(room, sub['head'])
    if cords:
        _cords(room, sub['cords'])
    _problem_props(room, sub['props'])
    _printer(room, sub['printer'])
    _droid(room, sub['droid'])
    _fills(room, sub['lights'])
    if placeholder:
        room.placeholder = stand_in(C.collection('Synergy_Placeholder'))
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


def demo_timeline(room):
    """The treatment's room events on the film timeline (used by previews; shots may copy it).

    Every object that is stopped and posted is hidden from its post frame on (as the
    shots will), Kevin's padlock comes back for S09, the droid swings out from beside
    the foot into its lane at f300."""
    pr = room.printer
    for f in (257, 321, 385, 449, 513, 577, 641, 705, 769, 833, 897):
        pr.feed(f)
    pr.led_pulse(1, 1048)
    pr.stop_mid(1049)
    pr.led_off(1049)
    room.droid.blink(1, 1440, 48)
    lane = ROOM['droid_lane_x']
    x0, y0 = ROOM['droid_start']
    # parked across the lane facing +X: it swings left into the lane over f300-330 (in
    # profile, bar and trolley trailing), then runs up the lane at a measured pace
    room.droid.place(299, x0, y0, ROOM['droid_start_heading'])
    room.droid.drive(300, 712, [(x0, y0), (x0 + 0.08, y0), (x0 + 0.16, y0 + 0.005), (lane - 0.08, y0 + 0.13),
                                (lane, y0 + 0.40), (lane, y0 + 1.2), (lane, -26.0), (lane, -8.0), (lane, -4.6),
                                (1.55, -3.4), ROOM['droid_bay']], ease='cruise')
    T = room.terminals
    T['kevin'].speak(353, 377, seed=7)
    pad = room.props['kevin'][0]
    home = prop_home('kevin')
    stop = Vector(stop_for('padlock', obj=pad, start=home))
    P.slide(pad, 377, 424, home, tuple(stop), settle=0.0, accel=0.55)
    pad.keyframe_insert('location', frame=520)        # holds at the stop until it is posted
    room.key_visible(pad, 519, False)                 # S05: posted at f510-518
    # S07 deferral machine (flares + slides arriving on the beats); each object is posted
    # and gone by the end of its cycle
    for nm, f in (('linda', 609), ('keys', 625), ('strategy', 641), ('people', 657), ('arjun', 673),
                  ('operations', 681), ('synthia', 689), ('strategy', 697)):
        T[nm].flare(f - 16 if f - 16 > 600 else f - 8)
    T['people'].speak(645, 657, seed=3)
    T['strategy'].speak(629, 641, seed=5)
    tabs = room.props['strategy'][0]
    P.slide(tabs, 627, 641, prop_home('strategy', 0), stop_for('tabs', obj=tabs, start=prop_home('strategy', 0)),
            settle=0.004)
    env = room.props['people'][0]
    P.slide(env, 643, 657, prop_home('people', 0), stop_for('envelope'), settle=0.004, spin_deg=540)
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


PREVIEW_YAW = {'s02_end': 's02', 's03_wide': 's03', 's04_start': 's04', 's04_tabletop': 's04',
               's07_profile_lane': 's07', 's09_low': 's09', 's10_jack_macro': 's10', 's11_shutdown': 's11',
               's11_pat': 's11', 's13_dark': 's13'}
# render_budget kind and insert kits per preview framing
PREVIEW_BUDGET = {'s04_start': 'macro', 's04_tabletop': 'macro', 's09_low': 'macro', 's10_jack_macro': 'macro',
                  's02_end': 'macro'}
PREVIEW_KITS = {'s04_start': ('padlock',), 's04_tabletop': ('padlock',), 's09_low': ('padlock',),
                's10_jack_macro': ('jack',), 's13_dark': ('sip',)}
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


def preview_camera(room, name):
    """(frame, camera) for the treatment framings used by tools/preview_room.py.
    Swivels the chairs to the shot's SHOT_SEAT_YAW first, and shows only the insert kits
    the framing uses (PREVIEW_KITS)."""
    sc = bpy.context.scene
    tz = ROOM['table_top_z']
    shot = PREVIEW_YAW.get(name)
    if shot is not None and abs(room.seat_yaw - SHOT_SEAT_YAW[shot]) > 1e-6:
        room.set_seat_yaw(SHOT_SEAT_YAW[shot])
    for kit in PREVIEW_KITS.get(name, ()):
        if kit == 'padlock':
            room.insert_lights('padlock', target=room.props['kevin'][0])
        else:
            room.insert_lights(kit)
    room.use_kits(*PREVIEW_KITS.get(name, ()))
    mset = getattr(room, 'macro_set', None)
    if mset:
        mset[0].hide_render = not name.startswith('macro_')
    room.hide_far_room(False)
    if getattr(room, 'mirror', False) and name != 's02_end':
        room.head_mirror(False)
    if name == 's03_wide':
        # level camera on the axis behind the foot (the foot wall is hidden), shifted down for
        # rigid one-point verticals: 50 mm, so the walls converge out of the frame edges and
        # the lit table, the nine screens and the host are the figure; the printer on its chair
        # is the soft lower foreground, the droid swings out at the lower right. 1.5 m push.
        room.hide_from_camera('foot')
        f = 300
        cam = bpy.data.objects.get('cam_s03') or C.camera('cam_s03', 50.0, (0, -39.0, 2.6), None, fstop=8.0,
                                                           focus=20.0, clip=(0.05, 200.0))
        cam.rotation_euler = (math.pi / 2, 0.0, 0.0)
        cam.data.lens = 50.0
        cam.data.shift_y = -0.13
        cam.data.dof.focus_distance = 20.0
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
    if name == 's07_profile_lane':
        # down-table of him on his right (2.0 m right, 0.95 m down-table, 1.55 m high), 35 mm:
        # his face screen ~55 deg to the lens with the LEDs readable, the cup nearest camera,
        # the hub and the stop point at frame centre, objects arriving from frame right. (No
        # 35 mm frame holds both a readable face and the table's far vanishing point: from
        # anywhere his screen faces, the far end lies more than 90 deg from him.)
        room.hide_from_camera('head')
        f = 650
        sp = Vector(SYNERGY_POS)
        loc = Vector((sp.x - 2.0, sp.y - 0.95, 1.55))
        b = math.radians(16.0)
        cam = _cam('cam_s07', 35.0, tuple(loc), tuple(loc + Vector((math.cos(b), math.sin(b), -math.tan(math.radians(6.0))))),
                   fstop=8.0, focus=2.4)
        return f, cam
    if name == 's09_low':
        # lens 6 cm above the walnut, 0.9 m down-table from his stop point, looking back up
        room.hide_from_camera('head')
        f = 870
        sx, sy = stop_for('padlock')
        loc = Vector((sx - 0.06, sy - 1.15, tz + 0.06))
        cam = _cam('cam_s09', 40.0, tuple(loc), (sx * 0.45, SYNERGY_POS[1], 1.02), fstop=2.8)
        foc = bpy.data.objects.get('focus_s09') or C.empty('focus_s09', None, (sx, sy, tz + 0.03))
        cam.data.dof.focus_object = foc
        return f, cam
    if name == 's10_jack_macro':
        room.hide_from_camera()
        room.hide_far_room(True)
        f = 950
        s = Vector(ROOM['socket_pos']) + Vector((0.0, P.SOCKET_FACE, 0.0))
        tgt = s + Vector((-0.006, 0.016, 0.004))
        d = Vector((0.66, 0.50, 0.56)).normalized()
        foc = bpy.data.objects.get('focus_s10') or C.empty('focus_s10', None, tuple(s + Vector((0, 0.014, 0.0))))
        cam = _cam('cam_s10', 100.0, tuple(tgt + d * 0.30), tuple(tgt), fstop=4.0, focus=foc)
        cam.data.dof.focus_object = foc
        return f, cam
    if name in ('s11_shutdown', 's11_pat'):
        # behind-left of him, a touch above eye height and tilted up 2 deg: the slot's
        # far rounded end sits in the top of frame (the sip-hole rhyme)
        room.hide_from_camera('head')
        f = 1030 if name == 's11_shutdown' else 1110
        sp = Vector(SYNERGY_POS)
        cam = _cam(f'cam_{name}', 32.0, (sp.x + 0.5, sp.y + 1.4, 1.5),
                   (sp.x + 0.5, -30.0, 1.5 + 30.0 * math.tan(math.radians(1.0))), fstop=5.6, focus=1.5)
        return f, cam
    if name == 's13_dark':
        room.hide_from_camera()
        f = 1300
        sp = Vector(SYNERGY_POS)
        a = math.radians(8)
        loc = (sp.x - 1.9 * math.sin(a), sp.y - 1.9 * math.cos(a), 1.35)
        cam = _cam('cam_s13', 65.0, loc, (sp.x, sp.y, 1.42), fstop=2.8, focus=1.9)
        return f, cam
    if name == 's02_end':
        # the S02 end position (2.1 m in front, screen height, 10 deg to his right, 65 mm
        # f/2) with the smoked-glass head wall: the screens mirror behind him as colour discs
        room.hide_from_camera()
        room.head_mirror(True)
        f = 250
        sp = Vector(SYNERGY_POS)
        a = math.radians(10)
        loc = (sp.x - 2.1 * math.sin(a), sp.y - 2.1 * math.cos(a), 1.58)
        cam = _cam('cam_s02_end', 65.0, loc, (sp.x, sp.y, 1.50), fstop=2.0, focus=2.1)
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
