"""E2_LONG_ROOM: the 34 m boardroom around the 30 m walnut table (and E3 inserts' set).

    import env_room as R
    room = R.build(placeholder=True)       # everything, lit state
    room.terminals['kevin'].speak(353, 376)
    P.slide(room.props['kevin'][0], 377, 424, (-0.5, -11.6), (-0.3, -0.55))
    room.shutdown_wave(1001)               # S11 order, a screen every 5 frames
    room.set_state(1053, 'dark')
    room.compositor()                      # house look: glare, mist, vignette

Coordinates are fixed (shots depend on them) and exported in ROOM / SEATS:
metres, Z up, floor z=0, the table runs from its foot (y=-30) to its head edge
(y=0), and Synergy stands at SYNERGY_POS facing -Y (his right is -X).
One 6500K sun lays a hard slab down the table spine through a rounded-slot
skylight; each CRT pools its colour on the glossy walnut through its own area
light. No volumetrics: depth haze comes from the compositor mist pass.
"""

import math
import random

import bmesh
import bpy
from mathutils import Vector

import common as C
import props as P

# ================================================================== fixed coordinates

ROOM = dict(
    interior_x=(-4.5, 4.5), interior_y=(-32.5, 1.5), interior_z=(0.0, 6.0),
    floor_z=0.0,
    table_top_z=0.75, table_bottom_z=0.67, table_y=(-30.0, 0.0), table_half_w=0.8,
    plinth_half_w=0.40, plinth_y=(-29.25, -0.75),
    channel_width=0.13, channel_depth=0.035, channel_y=(-29.40, -0.40),
    synergy_pos=(0.0, 0.40, 0.0),
    hub_pos=(0.0, -0.30, 0.75),
    socket_pos=(0.22, 0.0, 0.70),          # set into the head edge, facing +Y
    printer_chair=(0.0, -31.2, 0.0),        # faces +Y (toward the host)
    printer_stack=(0.0, -30.66, 0.0),
    chair_x=1.25,
    seat_top_z=0.55,
    seat_yaw_deg=22.0,                      # colleagues turned toward the host (0 = square to the axis)
    droid_lane_x=1.9,
    droid_start=(1.9, -29.9),
    droid_bay=(1.15, -3.0),
    skylight_len=26.0, skylight_w=1.2, skylight_cy=-15.0, skylight_depth=0.9,
    sun_tilt_deg=30.0,                      # light travels toward +Y: the slab climbs onto the host
    prop_x=0.50,                            # problem props sit this far off the spine
)
SYNERGY_POS = ROOM['synergy_pos']
HUB_POS = ROOM['hub_pos']
SOCKET_POS = ROOM['socket_pos']
TABLE_TOP = ROOM['table_top_z']

# side: -1 = his right (-X, camera-left from the foot), +1 = his left (+X)
SEATS = {
    'synthia': (-1, -3.0), 'keys': (-1, -8.0), 'kevin': (-1, -13.0), 'operations': (-1, -18.0), 'pat': (-1, -23.0),
    'droid_bay': (1, -3.0), 'arjun': (1, -8.0), 'strategy': (1, -13.0), 'people': (1, -18.0), 'linda': (1, -23.0),
}
TERMINALS = ['synthia', 'keys', 'kevin', 'operations', 'pat', 'arjun', 'strategy', 'people', 'linda']
# lanes inside the brass channel (x offset); farthest terminals run nearest the centre line
LANES = {'pat': -0.0059, 'operations': -0.0177, 'kevin': -0.0295, 'keys': -0.0413, 'synthia': -0.0531,
         'linda': 0.0059, 'people': 0.0177, 'strategy': 0.0295, 'arjun': 0.0413}
# what waits on the walnut in front of each colleague
PROPS = {
    'synthia': ['envelope'], 'keys': ['envelope'], 'kevin': ['padlock'], 'operations': ['envelope'],
    'pat': ['envelope'], 'arjun': ['tabs'], 'strategy': ['tabs', 'tabs'], 'people': ['envelope'],
    'linda': ['glass_zero'],
}
SHUTDOWN_ORDER = ['synthia', 'keys', 'arjun', 'kevin', 'strategy', 'operations', 'people', 'linda']

LIGHT = dict(sun=12.0, sun_angle=0.35, diffuser=1.15, fill=0.08, crt=3.2, wash=0.45)


def seat_xy(name):
    side, y = SEATS[name]
    return side * ROOM['chair_x'], y


def prop_home(name, index=0):
    """Resting place of a colleague's problem object on the walnut (x, y)."""
    side, y = SEATS[name]
    if name == 'kevin':
        return side * ROOM['prop_x'], y + 1.40          # hero padlock: 1.5 m in front of Kevin's screen
    return side * ROOM['prop_x'], y + 0.60 - 0.42 * index


# ================================================================== Room handle


class Room:
    """Everything the shots animate. Attributes:

    terminals{name: props.Terminal}   chairs{name: instance}    cords{name: curve obj}
    props{name: [objects]}            printer (props.Printer)   droid (props.Droid)
    hub (props.Hub)  socket  jack (props.Jack)  master (props.MasterCord)
    sun  diffuser  fills[]  walls{'head','foot','left','right'}  table  placeholder (or None)
    """

    def __init__(self):
        self.terminals = {}
        self.chairs = {}
        self.cords = {}
        self.props = {}
        self.walls = {}
        self.fills = []
        self.placeholder = None

    # --- room-wide lighting state
    def set_state(self, frame, state, ramp=0):
        """'lit' (meeting on) or 'dark' (after the unplug), switched at `frame` (or faded
        over `ramp` frames). Keys the ambient fills and the skylight diffuser; the slab
        (sun) always stays. Terminals keep their own keys."""
        lit = state == 'lit'
        prev = getattr(self, '_state', None)
        targets = [(l.data, 'energy', e if lit else e * 0.04, e if prev == 'lit' else e * 0.04) for l, e in self.fills]
        d = LIGHT['diffuser']
        targets.append((self.diffuser_strength, 'default_value', d if lit else d * 0.55,
                        d if prev == 'lit' else d * 0.55))
        for owner, path, new, old in targets:
            if prev is not None and ramp > 0:
                setattr(owner, path, old)
                owner.keyframe_insert(path, frame=frame)
                setattr(owner, path, new)
                owner.keyframe_insert(path, frame=frame + ramp)
            else:
                setattr(owner, path, new)
                owner.keyframe_insert(path, frame=frame)
        for idb in [l.data for l, _ in self.fills] + [self.diffuser_mat.node_tree]:
            ad = idb.animation_data
            if ad and ad.action:
                for fc in C.fcurves(ad.action):
                    for kp in fc.keyframe_points:
                        if abs(kp.co.x - frame) < 1e-3 and ramp == 0:
                            kp.interpolation = 'CONSTANT'
                        elif abs(kp.co.x - frame) < 1e-3:
                            kp.interpolation = 'LINEAR'
                    # keys before this one hold until it
                    for kp in fc.keyframe_points:
                        if kp.co.x < frame - 1e-3 and ramp == 0:
                            kp.interpolation = 'CONSTANT'
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

    def compositor(self, glare=0.35, mist_amount=0.55, vignette=0.25):
        C.compositor(glare=glare, glare_threshold=0.9, glare_size=8, vignette=vignette,
                     mist=dict(color=(0.006, 0.008, 0.016), start=6.0, depth=46.0, amount=mist_amount,
                               falloff='LINEAR'))


# ================================================================== builders


def _shell(room, coll):
    x0, x1 = ROOM['interior_x']
    y0, y1 = ROOM['interior_y']
    z1 = ROOM['interior_z'][1]
    # floor
    floor = P.box('room_floor', (x1 - x0 + 0.6, y1 - y0 + 0.6, 0.02), ((x0 + x1) / 2, (y0 + y1) / 2, -0.01),
                  P.carpet(), coll)
    # structural walls (dark), lined with fabric acoustic panels
    back = P.flat((0.004, 0.004, 0.005), 0.9)
    T = 0.3
    walls = {
        'left': P.box('wall_left', (T, y1 - y0 + 2 * T, z1 + 0.6), (x0 - T / 2 - 0.05, (y0 + y1) / 2, z1 / 2 + 0.3), back, coll),
        'right': P.box('wall_right', (T, y1 - y0 + 2 * T, z1 + 0.6), (x1 + T / 2 + 0.05, (y0 + y1) / 2, z1 / 2 + 0.3), back, coll),
        'foot': P.box('wall_foot', (x1 - x0 + 2 * T, T, z1 + 0.6), ((x0 + x1) / 2, y0 - T / 2 - 0.05, z1 / 2 + 0.3), back, coll),
        'head': P.box('wall_head', (x1 - x0 + 2 * T, T, z1 + 0.6), ((x0 + x1) / 2, y1 + T / 2 + 0.05, z1 / 2 + 0.3), back, coll),
    }
    room.walls = {k: [v] for k, v in walls.items()}
    # one acoustic panel mesh, linked everywhere (Cycles instances it)
    pw, ph, pd = 1.188, 5.70, 0.05
    bm = bmesh.new()
    P.bm_pillow(bm, pw, pd, ph, 0.006, 0.005, steps=2, seg=3)
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
    N = 192
    hole = P.resample_closed([(-y, x) for x, y in P.stadium(L, W, 24)], N)
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
    # light well: plaster walls around the slot, slightly flared
    bm = bmesh.new()
    hi_outline = P.resample_closed([(-y, x) for x, y in P.stadium(L + 0.02, W + 0.02, 24)], N)
    hi_outline = [(x, y + cy) for x, y in hi_outline]
    lo = [(x, y, z - 0.002) for x, y in hole]
    hi = [(x, y, z + dep) for x, y in hi_outline]
    P.bm_loft(bm, [lo, hi], True, False, False, 0)
    well = P.to_object(bm, 'skylight_well', [P.plaster(0.6)], coll, smooth=40.0)
    # diffuser: the hot slot seen from below; casts no shadow so the sun passes
    bm = bmesh.new()
    vs = P.bm_ring(bm, [(x, y, z + dep - 0.02) for x, y in hi_outline])
    P.bm_cap(bm, vs, 0, flip=True)
    diff = P.to_object(bm, 'skylight_diffuser', [P.skylight_diffuser(LIGHT['diffuser'])], coll, smooth=None,
                       recalc=False)
    diff.visible_shadow = False
    # make sure the emitting face points down into the room
    me = diff.data
    if me.polygons[0].normal.z > 0:
        me.flip_normals()
    mat = diff.data.materials[0]
    room.diffuser = diff
    room.diffuser_strength = _emission_strength_socket(mat)
    room.diffuser_mat = mat
    room.ceiling = ceil
    room.well = well
    # the sun: hard 6500K slab down the spine, tilted so it climbs onto the host
    sun = C.sun_light('room_sun', (ROOM['sun_tilt_deg'], 0, 0), LIGHT['sun'], LIGHT['sun_angle'], coll=coll)
    sun.data.use_temperature = True
    sun.data.temperature = 6500
    room.sun = sun
    room.sun_rot = tuple(sun.rotation_euler)
    return ceil


def _emission_strength_socket(mat):
    for n in mat.node_tree.nodes:
        if n.type == 'EMISSION':
            # strength is driven by (bars * strength): find the multiply feeding it
            link = n.inputs['Strength'].links
            if link:
                src = link[0].from_node
                return src.inputs[1]
            return n.inputs['Strength']
    raise RuntimeError('no emission')


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
    # recessed rounded-slot cable channel down the spine
    c0, c1 = ROOM['channel_y']
    cw, cd = ROOM['channel_width'], ROOM['channel_depth']
    cut = [(-y, x) for x, y in P.stadium(c1 - c0, cw + 0.003, 16)]
    cut = [(x, y + (c0 + c1) / 2) for x, y in cut]
    bm = bmesh.new()
    P.bm_prism(bm, cut, tz - cd, tz + 0.05)
    cutter = P.to_object(bm, 'table_channel_cutter', [], coll)
    cutter.hide_render = True
    cutter.hide_viewport = True
    bo = top.modifiers.new('Channel', 'BOOLEAN')
    bo.operation = 'DIFFERENCE'
    bo.solver = 'EXACT'
    bo.object = cutter
    # bore for the socket in the head edge
    sx, sy, sz = ROOM['socket_pos']
    hole = P.cylinder('table_socket_bore', 0.0040, 0.03, (sx, sy, sz), None, coll, 24, 'Y')
    hole.hide_render = True
    hole.hide_viewport = True
    bo2 = top.modifiers.new('SocketBore', 'BOOLEAN')
    bo2.operation = 'DIFFERENCE'
    bo2.solver = 'EXACT'
    bo2.object = hole
    P.soft_bevel(top, 0.0025, 3, 30)
    room.table = top
    # brass liner: walls + floor + a flush lip around the slot
    N = 260
    inner = P.resample_closed([(-y, x) for x, y in P.stadium(c1 - c0, cw, 20)], N)
    inner = [(x, y + (c0 + c1) / 2) for x, y in inner]
    lip = P.resample_closed([(-y, x) for x, y in P.stadium(c1 - c0 + 0.010, cw + 0.010, 20)], N)
    lip = [(x, y + (c0 + c1) / 2) for x, y in lip]
    bm = bmesh.new()
    r_lip = P.bm_ring(bm, [(x, y, tz + 0.0004) for x, y in lip])
    r_top = P.bm_ring(bm, [(x, y, tz + 0.0004) for x, y in inner])
    r_in = P.bm_ring(bm, [(x, y, tz - 0.0015) for x, y in inner])
    r_bot = P.bm_ring(bm, [(x, y, tz - cd) for x, y in inner])
    P.bm_bridge(bm, r_lip, r_top, 0)
    P.bm_bridge(bm, r_top, r_in, 0)
    P.bm_bridge(bm, r_in, r_bot, 0)
    P.bm_cap(bm, r_bot, 1)
    liner = P.to_object(bm, 'brass_channel', [P.brass('brushed'), P.brass('aged')], coll, smooth=35.0, recalc=False)
    room.channel = liner
    # plinth: a recessed black monolith under the slab
    pw = ROOM['plinth_half_w']
    p0, p1 = ROOM['plinth_y']
    plinth = P.box('table_plinth', (2 * pw, p1 - p0, bz - 0.06), (0, (p0 + p1) / 2, (bz - 0.06) / 2 + 0.06),
                   P.lacquer_black(), coll, 0.004)
    toe = P.box('table_plinth_toe', (2 * pw - 0.08, p1 - p0 - 0.08, 0.06), (0, (p0 + p1) / 2, 0.03),
                P.flat((0.002, 0.002, 0.002), 0.7), coll)
    return top


def _seats(room, coll):
    seat_top = ROOM['seat_top_z']
    for name, (side, y) in SEATS.items():
        x = side * ROOM['chair_x']
        yaw = math.radians(ROOM['seat_yaw_deg'])
        rot = (-math.pi / 2 + yaw) if side < 0 else (math.pi / 2 - yaw)   # face the axis, turned to the host
        if name == 'droid_bay':
            continue
        ch = P.office_chair(f'chair_{name}', coll, (x, y, 0.0), rot)
        room.chairs[name] = ch
        # the terminal sits on the seat, back against the chair back
        off = Vector((0.0, 0.04, 0.0))
        fwd = Vector((-math.sin(rot), math.cos(rot), 0.0))
        loc = Vector((x, y, seat_top)) + fwd * off.y
        rgb = P.srgb(P.TERMINAL_HEX[name])
        e = 22.0 * LIGHT['crt'] * min(2.2, 0.45 / max(P._luma(rgb), 0.2) ** 0.5)
        t = P.crt_terminal(name, P.TERMINAL_HEX[name], coll, tuple(loc), rot,
                           powered=(name != 'pat'),
                           level=0.9 if name == 'pat' else None, energy=6.0 if name == 'pat' else e)
        room.terminals[name] = t


def _cord_points(room, name):
    """Centreline of a terminal's cord: out of the CRT, over the seat edge, a soft sag,
    up over the table edge, diagonally across the walnut into the brass channel, then
    straight along its lane to the hub."""
    t = room.terminals[name]
    side, y = SEATS[name]
    tz = ROOM['table_top_z']
    hw = ROOM['table_half_w']
    rc = 0.0042 + 0.0013                     # coil outer radius: lies on surfaces
    lane = LANES[name]
    cz = tz - ROOM['channel_depth'] + rc
    ex = t.cord_exit()
    s = side
    pts = [
        ex,
        t.to_world((0.0, 0.215, 0.012)),
        t.to_world((0.01, 0.262, -0.02)),
        Vector((s * 0.93, y + 0.03, 0.47)),
        Vector((s * (hw + 0.02), y + 0.06, tz - 0.06)),
        Vector((s * (hw - 0.006), y + 0.08, tz + rc)),
        Vector((s * (hw - 0.12), y + 0.11, tz + rc)),
        Vector((s * 0.30, y + 0.25, tz + rc)),
        Vector((s * 0.10, y + 0.34, tz + rc)),
        Vector((lane + s * 0.03, y + 0.40, tz - 0.004)),
        Vector((lane, y + 0.48, cz)),
        Vector((lane, y + 0.62, cz)),
        Vector((lane, ROOM['channel_y'][1] - 0.02, cz)),
    ]
    return pts


def _cords(room, coll):
    mat = P.cord_plastic()
    for name in TERMINALS:
        pts = _cord_points(room, name)
        dense = P.catmull(pts[:-1], 10) + [pts[-1]]
        cord = P.build_coil(dense, f'cord_{name}', coll, pitch=0.0056, samples_per_turn=6, profile=5,
                            smooth_points=False, mat=mat)
        room.cords[name] = cord


def _head(room, coll):
    hub = P.conference_hub('hub', coll, ROOM['hub_pos'])
    room.hub = hub
    sock = P.brass_socket('socket', coll, ROOM['socket_pos'])
    room.socket = sock
    jack = P.gold_jack('jack', coll, ROOM['socket_pos'])
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
                                    (sx - 0.004, 0.016, tz + rc + 0.004), (sx, 0.060, tz - 0.012))]


def _problem_props(room, coll):
    for name, kinds in PROPS.items():
        objs = []
        side, y = SEATS[name]
        for i, kind in enumerate(kinds):
            x, yy = prop_home(name, i)
            loc = (x, yy, ROOM['table_top_z'])
            if kind == 'padlock':
                o = P.padlock(f'padlock_{name}', coll, loc, math.radians(90 + 8))
            elif kind == 'glass_zero':
                o = P.glass_zero(f'zero_{name}', coll, loc)
            elif kind == 'envelope':
                o = P.envelope(f'envelope_{name}{i}', coll, loc, math.radians(90 + side * 4))
            else:
                o = P.tab_stack(f'tabs_{name}{i}', coll, loc, math.radians(side * 90 + 6 * (i - 0.5)))
            objs.append(o)
        room.props[name] = objs


def _printer(room, coll):
    cx, cy, _ = ROOM['printer_chair']
    ch = P.office_chair('chair_printer', coll, (cx, cy, 0.0), 0.0)
    room.chairs['printer'] = ch
    seat = ROOM['seat_top_z']
    pr = P.laser_printer('printer', coll, (cx, cy + 0.02, seat), 0.0,
                         stack_offset=(0.0, ROOM['printer_stack'][1] - (cy + 0.02), 0.0), stack_height=0.30,
                         stack_floor_z=-seat)
    room.printer = pr


def _droid(room, coll):
    x, y = ROOM['droid_start']
    d = P.paper_droid('droid', coll, (x, y, 0.0), 0.0)
    room.droid = d


def _fills(room, coll):
    """Very low ambient so the charcoal panels and the chair silhouettes read."""
    x0, x1 = ROOM['interior_x']
    y0, y1 = ROOM['interior_y']
    fills = []
    for i, yy in enumerate((-26.0, -15.0, -4.0)):
        l = C.area_light(f'fill_{i}', (0.0, yy, 5.6), (0.0, yy, 0.0), 120.0 * LIGHT['fill'], 7.0, 9.0,
                         color=(0.85, 0.88, 1.0), coll=coll)
        l.data.size_y = 10.0
        l.visible_camera = False
        l.visible_glossy = False
        fills.append((l, l.data.energy))
    # cool grazing wash down each long wall so the panel edges read as a rhythm
    for side in (-1, 1):
        l = C.area_light(f'wallwash_{side}', (side * (x1 - 0.7), (y0 + y1) / 2, 5.85), None,
                         300.0 * LIGHT['wash'], 0.4, color=(0.62, 0.72, 1.0), coll=coll)
        l.data.size_y = 34.0
        l.data.spread = math.radians(70)
        aim_light(l, Vector((side * 1.0, 0.0, -1.3)))
        l.visible_camera = False
        l.visible_glossy = False
        fills.append((l, l.data.energy))
    room.fills = fills


def aim_light(light, direction, along=(0.0, 1.0, 0.0)):
    """Point an area light along `direction` keeping its size_y axis along `along`."""
    from mathutils import Matrix
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
    cup = P.cup_and_lid('ph_cup', coll, (pos[0] - 0.22, pos[1] - 0.30, 1.22 - 0.065), 0.0, hero=False)
    return rt


def build(placeholder=False, state='lit', cords=True):
    """Build the whole Long Room into the current scene. Returns a Room handle.
    placeholder=True adds the 1.75 m grey stand-in for Synergy at SYNERGY_POS."""
    room = Room()
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
    return room


# ================================================================== demo timeline + preview cameras


def demo_timeline(room):
    """The treatment's room events on the film timeline (used by previews; shots may copy it)."""
    pr = room.printer
    for f in (257, 321, 385, 449, 513, 577, 641, 705, 769, 833, 897):
        pr.feed(f)
    pr.led_pulse(1, 1048)
    pr.stop_mid(1049)
    pr.led_off(1049)
    room.droid.blink(1, 1440, 48)
    lane = ROOM['droid_lane_x']
    room.droid.drive(300, 712, [ROOM['droid_start'], (lane, -26.0), (lane, -8.0), (lane, -4.6), (1.55, -3.4),
                                ROOM['droid_bay']])
    T = room.terminals
    T['kevin'].speak(353, 377, seed=7)
    pad = room.props['kevin'][0]
    P.slide(pad, 377, 424, prop_home('kevin'), (-0.26, -0.62), settle=0.0, accel=0.55)
    # S07 deferral machine (flares + slides arriving on the beats)
    for nm, f in (('linda', 609), ('keys', 625), ('strategy', 641), ('people', 657), ('arjun', 673),
                  ('operations', 681), ('synthia', 689), ('strategy', 697)):
        T[nm].flare(f - 16 if f - 16 > 600 else f - 8)
    T['people'].speak(645, 657, seed=3)
    T['strategy'].speak(629, 641, seed=5)
    P.slide(room.props['strategy'][0], 627, 641, prop_home('strategy', 0), (0.24, -0.62), settle=0.004)
    P.slide(room.props['people'][0], 643, 657, prop_home('people', 0), (0.20, -0.66), settle=0.004, spin_deg=540)
    # S09 Kevin again
    T['kevin'].speak(833, 869, seed=7)
    # S10 the jack pull on the downbeat
    j = room.jack.root
    j.keyframe_insert('location', frame=960)
    j.location = (j.location.x, j.location.y + 0.025, j.location.z + 0.018)
    j.keyframe_insert('location', frame=963)
    room.master.pulled(961)
    room.hub.leds_off(961)
    # S11 the shutdown wave, the dark, Pat joins late
    room.shutdown_wave(1001)
    room.set_state(1053, 'dark')
    T['pat'].power_on(1085)
    # S13 the slab drifts as the room tilts
    room.sun_drift(1305, 1344, 0.20)


def _cam(name, lens, loc, target, fstop=0.0, focus=None, shift_y=0.0, roll=0.0):
    cam = bpy.data.objects.get(name)
    if cam is None:
        cam = C.camera(name, lens, loc, target, fstop=fstop, focus=focus, clip=(0.005, 200.0))
    else:
        cam.location = loc
        C.look_at(cam, target)
    if roll:
        cam.rotation_euler.rotate_axis('Z', math.radians(roll))
    cam.data.shift_y = shift_y
    return cam


def preview_camera(room, name):
    """(frame, camera) for the treatment framings used by tools/preview_room.py."""
    sc = bpy.context.scene
    tz = ROOM['table_top_z']
    if name == 's03_wide':
        room.hide_from_camera('foot')
        f = 300
        t = (f - 257) / 95
        y = -32.4 + 2.5 * C.ease(t, 'out') * 0.9
        z = 2.45
        cam = _cam('cam_s03', 28.0, (0.0, y, z), (0.0, 0.0, z), shift_y=-0.035, fstop=8.0, focus=14.0)
        return f, cam
    if name == 's04_tabletop':
        room.hide_from_camera()
        f = 390
        pad = room.props['kevin'][0]
        home = Vector((*prop_home('kevin'), tz))
        crt = room.terminals['kevin'].to_world((0.0, P.CRT['front'], P.CRT['zs']))
        d = (Vector((home.x, home.y, 0)) - Vector((crt.x, crt.y, 0))).normalized()
        off = d * 0.5 + Vector((0, 0, 0.03))
        aim = Vector((crt.x * 0.55 + home.x * 0.45, crt.y * 0.55 + home.y * 0.45, tz + 0.06)) - home
        cam = _cam('cam_s04', 40.0, tuple(home + off), tuple(home + aim), fstop=2.8, focus=0.5)
        foc = C.empty('focus_s04', None, tuple(home + Vector((0, 0, 0.035))))
        cam.data.dof.focus_object = foc
        # ride beside the padlock: camera and focus follow it around the preview frame
        for fr in range(f - 2, f + 3):
            sc.frame_set(fr)
            p = pad.matrix_world.translation.copy()
            cam.location = p + off
            cam.keyframe_insert('location', frame=fr)
            foc.location = p + Vector((0, 0, 0.035))
            foc.keyframe_insert('location', frame=fr)
        return f, cam
    if name == 's07_profile_lane':
        room.hide_from_camera()
        f = 650
        cam = _cam('cam_s07', 30.0, (-1.75, -1.05, 1.55), (1.05, -6.8, 0.95), fstop=8.0, focus=4.0)
        return f, cam
    if name == 's10_jack_macro':
        room.hide_from_camera()
        f = 950
        s = Vector(ROOM['socket_pos'])
        d = Vector((0.80, 0.50, 0.55)).normalized()
        foc = C.empty('focus_s10', None, tuple(s + Vector((0, 0.016, 0.0))))
        cam = _cam('cam_s10', 100.0, tuple(s + d * 0.30), tuple(s + Vector((-0.020, 0.010, 0.016))), fstop=4.0,
                   focus=foc)
        cam.data.dof.focus_object = foc
        return f, cam
    if name == 's11_shutdown':
        room.hide_from_camera('head')
        f = 1030
        sp = Vector(SYNERGY_POS)
        cam = _cam('cam_s11', 32.0, (sp.x - 0.5, sp.y + 1.4, 1.5), (sp.x - 0.5, -30.0, 1.5 - 30.0 * math.tan(math.radians(2.0))),
                   fstop=5.6, focus=1.5)
        return f, cam
    if name == 's13_dark':
        room.hide_from_camera()
        f = 1300
        sp = Vector(SYNERGY_POS)
        a = math.radians(8)
        loc = (sp.x - 1.9 * math.sin(a), sp.y - 1.9 * math.cos(a), 1.35)
        cam = _cam('cam_s13', 65.0, loc, (sp.x, sp.y, 1.42), fstop=2.8, focus=1.9)
        return f, cam
    raise KeyError(name)
