"""E2_LONG_ROOM: the 34 m boardroom around the 30 m walnut table (and E3 inserts' set).

    import env_room as R
    room = R.build(placeholder=True, seat_yaw_deg=R.SHOT_SEAT_YAW['s03'])
    room.terminals['kevin'].speak(353, 376)
    P.slide(room.props['kevin'][0], 377, 424, R.prop_home('kevin'), R.ROOM['stop_L'])
    room.shutdown_wave(1001)               # S11 order, a screen every 5 frames
    room.set_state(1053, 'dark')
    room.tune_scanlines(cam)               # moire-safe CRT scanlines for this lens
    room.compositor()                      # house look: glare, mist, vignette

Coordinates are fixed (shots depend on them) and exported in ROOM / SEATS:
metres, Z up, floor z=0, the table runs from its foot (y=-30) to its head edge
(y=0), and Synergy stands at SYNERGY_POS facing -Y (his right is -X).
One 6500K sun lays a hard 0.75 m slab down the table spine through a rounded-slot
skylight; each CRT pools its colour on the glossy walnut through its own area
light. No volumetrics: depth haze comes from the compositor mist pass.

Cords: each terminal's yellow coiled cord drops from the CRT, loops under the
table edge, runs beneath the walnut and rises through a grommet into the brass
channel at its own seat, then runs in its own lane to the hub. The walnut
surface stays clear, so every prop home and slide lane is free of cords, and the
channel fills with yellow toward the host.

Per-shot chair swivel: terminals face the host by default (seat_yaw_deg); shots
that look up-table from the foot swivel them toward the camera
(build(seat_yaw_deg=...) or room.set_seat_yaw(deg); SHOT_SEAT_YAW has the values).
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
    printer_stack=(0.0, -30.66, 0.0),
    chair_x=1.25,
    seat_top_z=0.55,
    seat_yaw_deg=22.0,                      # colleagues turned toward the host (0 = square to the axis)
    seat_yaw_wide_deg=-40.0,                # chair-swivel cheat: screens toward the foot camera (S03)
    droid_lane_x=1.9,
    droid_start=(1.9, -29.9),
    droid_bay=(1.15, -3.0),
    skylight_len=28.4, skylight_w=0.75, skylight_cy=-13.6, skylight_depth=0.9,   # slot y -27.8 .. +0.6
    mullion_pitch=1.3,
    sun_tilt_deg=10.0,                      # light travels toward +Y: the slab reaches over the host
    prop_x=0.50,                            # problem props sit this far off the spine
    # Synergy's left index fingertip resting on the walnut (reach_L preset at SYNERGY_POS:
    # wrist (0.30, -0.36, 0.93) local, hand pitched down) and where a sliding object's centre
    # stops against it (padlock-sized; see stop_for()).
    fingertip_L=(0.29, -0.09, 0.755),
    stop_L=(0.29, -0.12),
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

LIGHT = dict(sun=10.5, sun_angle=0.35, diffuser=4.0, fill=0.10, crt=6.5, wash=0.30, pat=40.0, foot=6.0)

CORD_RC = 0.0042 + 0.0013                  # coil outer radius
STOP_HALF = {'padlock': 0.016, 'envelope': 0.012, 'tabs': 0.025, 'glass_zero': 0.064, 'binder': 0.15}


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


def stop_for(kind='padlock'):
    """(x, y) where an object of `kind` stops against Synergy's left fingertip."""
    fx, fy, _ = ROOM['fingertip_L']
    return fx, fy - 0.008 - STOP_HALF.get(kind, 0.02)


# ================================================================== Room handle


class Room:
    """Everything the shots animate. Attributes:

    terminals{name: props.Terminal}   chairs{name: instance}    cords{name: curve obj}
    props{name: [objects]}            printer (props.Printer)   droid (props.Droid)
    hub (props.Hub)  socket  jack (props.Jack)  master (props.MasterCord)
    sun  diffuser  fills[]  walls{'head','foot','left','right'}  table  placeholder (or None)
    seat_yaw (degrees)  insert{} (lights/dust added by insert_lights)
    """

    def __init__(self):
        self.terminals = {}
        self.chairs = {}
        self.cords = {}
        self.props = {}
        self.walls = {}
        self.fills = []
        self.insert = {}
        self.placeholder = None
        self.seat_yaw = ROOM['seat_yaw_deg']

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

    def set_seat_yaw(self, yaw_deg):
        """Swivel every colleague's chair (and terminal, glow and cord with it) to
        `yaw_deg` (+ toward the host, - toward the foot). Rebuilds the cords."""
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

    def tune_scanlines(self, cam=None, res_x=None):
        """Moire-safe CRT scanlines for this camera's lens and the render width."""
        sc = bpy.context.scene
        cam = cam or sc.camera
        res_x = res_x or sc.render.resolution_x * sc.render.resolution_percentage / 100.0
        return P.set_scanlines(cam.data.lens, res_x, cam.data.sensor_width)

    def insert_lights(self, kind='jack', dust=True, cache_dir=None, target=None, card_dir=None):
        """Insert light kits lit inside the room. Returns the dict of added objects.

        'jack': the head edge faces away from the sun, so add a warm walnut bounce card
        below and in front of the socket, a cool 6500K kicker raking along the knurl and
        a small rim (none seen by camera), plus dust motes drifting in the slab.
        'padlock': a soft warm card that rides with `target` (default Kevin's padlock),
        0.55 m out along `card_dir` (default: the camera side, away from Kevin's screen),
        for the S04/S09 macro: the brass reads instead of silhouetting."""
        coll = C.collection('LR_insert', C.collection('LongRoom'))
        out = {}
        if kind == 'jack':
            s = Vector(ROOM['socket_pos'])
            b = C.area_light('ins_bounce', tuple(s + Vector((0.03, 0.16, -0.10))), tuple(s + Vector((0.0, 0.02, 0.0))),
                             0.30, 0.18, 0.10, color=(1.0, 0.70, 0.46), coll=coll)
            k = C.area_light('ins_kicker', tuple(s + Vector((-0.10, 0.05, 0.22))), tuple(s + Vector((0.0, 0.02, 0.0))),
                             0.20, 0.035, 0.12, color=(0.86, 0.91, 1.0), coll=coll)
            r = C.area_light('ins_rim', tuple(s + Vector((0.20, 0.10, 0.06))), tuple(s + Vector((0.0, 0.025, 0.0))),
                             0.05, 0.05, color=(1.0, 0.93, 0.85), coll=coll)
            for l in (b, k, r):
                l.visible_camera = False
                l.visible_glossy = l is b                # only the warm bounce card shows in the brass and gold
                l.data.spread = math.radians(60)
            out.update(bounce=b, kicker=k, rim=r)
            if dust:
                out['dust'] = P.dust_motes('ins_dust', coll, center=(0.16, 0.14, 0.86), size=(0.6, 0.40, 0.36), n=320,
                                           cache_dir=cache_dir)
        elif kind == 'padlock':
            # a soft warm card that rides with the padlock on the camera side, so the brass
            # face shows its patina, scratches and prints instead of a silhouette
            tgt = target or self.props['kevin'][0]
            bpy.context.view_layer.update()
            p = tgt.matrix_world.translation.copy()
            if card_dir is None:
                crt = self.terminals['kevin'].to_world((0.0, P.CRT['front'], P.CRT['zs']))
                card_dir = (Vector((p.x, p.y, 0)) - Vector((crt.x, crt.y, 0))).normalized()
            pos = p + Vector(card_dir).normalized() * 0.55 + Vector((0.0, 0.0, 0.16))
            c = C.area_light('ins_padlock_card', tuple(pos), tuple(p + Vector((0, 0, 0.03))), 0.9, 0.45, 0.22,
                             color=(1.0, 0.92, 0.82), coll=coll)
            bpy.context.view_layer.update()
            c.parent = tgt
            c.matrix_parent_inverse = tgt.matrix_world.inverted()
            c.visible_camera = False
            out['card'] = c
        else:
            raise KeyError(kind)
        self.insert.update(out)
        return out

    def render_budget(self, scene=None, still=False, samples=None):
        """Room-level render settings that hold a final Long Room frame under 35 s on an
        idle 4-core CPU (S03 at 1600x900 with motion blur measured 124 CPU-s, ~31 s):
        short bounce chains (the coat is a 2-bounce mirror), 12 spp with adaptive
        stopping at 0.06 and OIDN, uniform light picking (the light tree costs more
        than it saves with 18 local lights), motion blur off for locked-off plates
        (still=True)."""
        sc = scene or bpy.context.scene
        cy = sc.cycles
        cy.max_bounces = 4
        cy.diffuse_bounces = 2
        cy.glossy_bounces = 2
        cy.transmission_bounces = 4
        cy.transparent_max_bounces = 6
        cy.volume_bounces = 0
        cy.adaptive_threshold = max(cy.adaptive_threshold, 0.06)
        cy.adaptive_min_samples = 6
        cy.use_light_tree = False           # 18 lights, mostly local: uniform picking is cheaper here
        if samples:
            cy.samples = samples
        else:                                # final 32 -> 12, hero 48 -> 18 (OIDN cleans the rest)
            cy.samples = min(cy.samples, max(12, int(round(cy.samples * 0.375))))
        if hasattr(cy, 'denoising_quality'):
            cy.denoising_quality = 'BALANCED' if cy.denoising_quality == 'HIGH' else cy.denoising_quality
        if still:
            sc.render.use_motion_blur = False
        return sc

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
    # light well: plaster walls around the slot, slightly flared
    bm = bmesh.new()
    hi_outline = [(-y, x) for x, y in P.stadium(L + 0.02, W + 0.02, 32)]
    hi_outline = [(x, y + cy) for x, y in hi_outline]
    lo = [(x, y, z - 0.002) for x, y in hole]
    hi = [(x, y, z + dep) for x, y in hi_outline]
    P.bm_loft(bm, [lo, hi], True, False, False, 0)
    well = P.to_object(bm, 'skylight_well', [P.plaster(0.6)], coll, smooth=40.0)
    # diffuser: the hot slot seen from below. It clips to white and blooms, but it is
    # seen only by camera and glossy rays (no fill, no light sampling, no shadow), so
    # the sun alone lays the slab.
    bm = bmesh.new()
    vs = P.bm_ring(bm, [(x, y, z + dep - 0.02) for x, y in hi_outline])
    P.bm_cap(bm, vs, 0, flip=True)
    diff = P.to_object(bm, 'skylight_diffuser', [P.skylight_diffuser(LIGHT['diffuser'])], coll, smooth=None,
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
    # glazing bars every 1.3 m across the slot, just under the diffuser (dark against the
    # white; they cast no shadow, so the slab stays one clean band)
    pitch = ROOM['mullion_pitch']
    n = int(L // pitch)
    bars = bmesh.new()
    for i in range(1, n + 1):
        yb = cy - L / 2 + W / 2 + (L - W) * i / (n + 1)
        geom = bmesh.ops.create_cube(bars, size=1.0)
        for v in geom['verts']:
            v.co = Vector((v.co.x * (W + 0.04), v.co.y * 0.045 + yb, v.co.z * 0.07 + z + dep - 0.065))
    mull = P.to_object(bars, 'skylight_mullions', [P.flat((0.012, 0.012, 0.013), 0.5, 0.6)], coll, smooth=30.0)
    P.soft_bevel(mull, 0.004, 2)
    mull.visible_shadow = False
    room.mullions = mull
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
            # strength is driven by (bars * strength): find the multiply feeding it
            link = n.inputs['Strength'].links
            if link:
                src = link[0].from_node
                return src.inputs[1]
            return n.inputs['Strength']
    raise RuntimeError('no emission')


def _terminal_matrix(name, yaw_deg):
    """World matrix of a colleague's terminal root (on the seat, against the chair back)."""
    side, y = SEATS[name]
    x = side * ROOM['chair_x']
    rot = seat_rot(name, yaw_deg)
    fwd = Vector((-math.sin(rot), math.cos(rot), 0.0))
    loc = Vector((x, y, ROOM['seat_top_z'])) + fwd * 0.06
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
    # grommet opens through it). The lip carries the glints; the walls are aged dark.
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
    P.bm_bridge(bm, r_top, r_in, 0)
    P.bm_bridge(bm, r_in, r_bot, 1)
    liner = P.to_object(bm, 'brass_channel', [P.brass('brushed'), P.brass('aged')], coll, smooth=35.0, recalc=False)
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
                                    (sx - 0.004, 0.016, tz + rc + 0.004), (sx, 0.064, tz - 0.012))]


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
    """Low ambient so the charcoal panels, the carpet and the chair silhouettes read."""
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
    # neutral grazing wash down each long wall so the panel edges read as a rhythm
    for side in (-1, 1):
        l = C.area_light(f'wallwash_{side}', (side * (x1 - 0.7), (y0 + y1) / 2, 5.85), None,
                         300.0 * LIGHT['wash'], 0.4, color=(0.85, 0.88, 1.0), coll=coll)
        l.data.size_y = 34.0
        l.data.spread = math.radians(70)
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
    l = C.area_light('foot_fill', (0.0, -31.0, 5.4), (0.0, -30.6, 0.5), 10.0 * LIGHT['foot'], 2.4, 1.6,
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


def build(placeholder=False, state='lit', cords=True, seat_yaw_deg=None, render_budget=True):
    """Build the whole Long Room into the current scene. Returns a Room handle.

    placeholder=True adds the 1.75 m grey stand-in for Synergy at SYNERGY_POS.
    seat_yaw_deg swivels the colleagues for this shot (default ROOM['seat_yaw_deg'];
    see SHOT_SEAT_YAW). render_budget applies the room's render settings (Room.render_budget)."""
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
        room.render_budget()
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
    P.slide(pad, 377, 424, prop_home('kevin'), stop_for('padlock'), settle=0.0, accel=0.55)
    # S07 deferral machine (flares + slides arriving on the beats)
    for nm, f in (('linda', 609), ('keys', 625), ('strategy', 641), ('people', 657), ('arjun', 673),
                  ('operations', 681), ('synthia', 689), ('strategy', 697)):
        T[nm].flare(f - 16 if f - 16 > 600 else f - 8)
    T['people'].speak(645, 657, seed=3)
    T['strategy'].speak(629, 641, seed=5)
    P.slide(room.props['strategy'][0], 627, 641, prop_home('strategy', 0), stop_for('tabs'), settle=0.004)
    P.slide(room.props['people'][0], 643, 657, prop_home('people', 0), stop_for('envelope'), settle=0.004,
            spin_deg=540)
    # S09 Kevin again
    T['kevin'].speak(833, 869, seed=7)
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


PREVIEW_YAW = {'s03_wide': 's03', 's04_start': 's04', 's04_tabletop': 's04', 's07_profile_lane': 's07',
               's09_low': 's09', 's10_jack_macro': 's10', 's11_shutdown': 's11', 's11_pat': 's11', 's13_dark': 's13'}


def preview_camera(room, name):
    """(frame, camera) for the treatment framings used by tools/preview_room.py.
    Swivels the chairs to the shot's SHOT_SEAT_YAW first."""
    sc = bpy.context.scene
    tz = ROOM['table_top_z']
    shot = PREVIEW_YAW.get(name)
    if shot is not None and abs(room.seat_yaw - SHOT_SEAT_YAW[shot]) > 1e-6:
        room.set_seat_yaw(SHOT_SEAT_YAW[shot])
    if name == 's03_wide':
        # level camera on the axis behind the foot (the foot wall is hidden), shifted
        # down for rigid one-point verticals: skylight ends above, printer, its stack
        # and the droid's lane in the bottom fifth. 1 m push over the shot.
        room.hide_from_camera('foot')
        f = 300
        cam = bpy.data.objects.get('cam_s03') or C.camera('cam_s03', 32.0, (0, -39.5, 2.8), None, fstop=8.0,
                                                           focus=16.0, clip=(0.05, 200.0))
        cam.rotation_euler = (math.pi / 2, 0.0, 0.0)
        cam.data.lens = 32.0
        cam.data.shift_y = -0.062
        for fr, yy in ((257, -39.5), (352, -38.5)):
            cam.location = (0.0, yy, 2.8)
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
        if 'card' not in room.insert:
            room.insert_lights('padlock', target=pad)
        home = Vector((*prop_home('kevin'), tz))
        crt = room.terminals['kevin'].to_world((0.0, P.CRT['front'], P.CRT['zs']))
        d = (Vector((home.x, home.y, 0)) - Vector((crt.x, crt.y, 0))).normalized()
        off = d * 0.5 + Vector((0, 0, 0.03))
        aim = Vector((crt.x * 0.55 + home.x * 0.45, crt.y * 0.55 + home.y * 0.45, tz + 0.06)) - home
        cam = _cam(f'cam_{name}', 40.0, tuple(home + off), tuple(home + aim), fstop=2.8, focus=0.5)
        foc = C.empty(f'focus_{name}', None, tuple(home + Vector((0, 0, 0.035))))
        cam.data.dof.focus_object = foc
        if name == 's04_tabletop':
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
        # on his right, the cup nearest camera: he stands at frame right and the walnut and
        # terminals recede to a vanishing point left of centre. (The treatment's 1.6 m right /
        # 0.4 m down-table spot cannot hold both him and the table's vanishing point in one
        # 35 mm frame; this is the nearest framing that does.)
        room.hide_from_camera('head')
        f = 650
        sp = Vector(SYNERGY_POS)
        cam = _cam('cam_s07', 30.0, (sp.x - 1.05, sp.y + 1.05, 1.55), (sp.x + 0.55, sp.y - 6.5, 1.0), fstop=8.0,
                   focus=3.0)
        return f, cam
    if name == 's09_low':
        # lens 6 cm above the walnut, 0.9 m down-table from his stop point, looking back up
        room.hide_from_camera('head')
        f = 870
        sx, sy = stop_for('padlock')
        loc = Vector((sx - 0.06, sy - 1.15, tz + 0.06))
        cam = _cam('cam_s09', 40.0, tuple(loc), (sx * 0.45, SYNERGY_POS[1], 1.02), fstop=2.8)
        foc = C.empty('focus_s09', None, (sx, sy, tz + 0.03))
        cam.data.dof.focus_object = foc
        return f, cam
    if name == 's10_jack_macro':
        room.hide_from_camera()
        if not room.insert:
            room.insert_lights('jack')
        f = 950
        s = Vector(ROOM['socket_pos']) + Vector((0.0, P.SOCKET_FACE, 0.0))
        tgt = s + Vector((-0.006, 0.016, 0.004))
        d = Vector((0.66, 0.50, 0.56)).normalized()
        foc = C.empty('focus_s10', None, tuple(s + Vector((0, 0.014, 0.0))))
        cam = _cam('cam_s10', 100.0, tuple(tgt + d * 0.30), tuple(tgt), fstop=4.0, focus=foc)
        cam.data.dof.focus_object = foc
        return f, cam
    if name in ('s11_shutdown', 's11_pat'):
        room.hide_from_camera('head')
        f = 1030 if name == 's11_shutdown' else 1110
        sp = Vector(SYNERGY_POS)
        cam = _cam(f'cam_{name}', 32.0, (sp.x + 0.5, sp.y + 1.4, 1.5),
                   (sp.x + 0.5, -30.0, 1.5 - 30.0 * math.tan(math.radians(2.0))), fstop=5.6, focus=1.5)
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
