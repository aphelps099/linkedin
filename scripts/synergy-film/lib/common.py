"""Shared scene, render and animation helpers for the Synergy film.

Every shot script builds its scene from nothing with these helpers, so a
shot renders identically on any machine that has Blender 4.5 LTS.

    blender -b -P shots/s01_assembly.py -- --quality preview --frames 1-96

Frames are numbered on the film's global timeline (1-1440 at 24 fps) and
written to <out>/<shot>/<frame:04d>.png.
"""

import argparse
import math
import os
import sys

import bpy
from mathutils import Euler, Matrix, Vector

FPS = 24
FILM_FRAMES = 1440
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DEFAULT_OUT = os.environ.get('SYNERGY_FRAMES', os.path.join(ROOT, 'out', 'frames'))

# name: (width, height, samples, adaptive threshold, motion blur, denoise prefilter)
QUALITY = {
    'animatic': (640, 360, 6, 0.1, False, 'FAST'),
    'proof': (800, 450, 12, 0.06, True, 'FAST'),
    'preview': (960, 540, 16, 0.05, True, 'FAST'),
    'final': (1600, 900, 32, 0.03, True, 'ACCURATE'),
    'hero': (1920, 1080, 48, 0.02, True, 'ACCURATE'),
}


# ---------------------------------------------------------------- arguments

def require_blender_45():
    """The film is written against the Blender 4.5 LTS Python API; stop early on anything else."""
    if tuple(bpy.app.version[:2]) != (4, 5):
        sys.exit(f'This film needs Blender 4.5 LTS; this is Blender {bpy.app.version_string}. '
                 'Install 4.5.15 alongside it and set BLENDER to it (see RENDER_ON_MAC.md).')


def shot_args():
    """Parse the arguments after `--` on the Blender command line."""
    require_blender_45()
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument('--quality', default='preview', choices=sorted(QUALITY))
    p.add_argument('--frames', default='', help='a-b on the film timeline; empty = whole shot')
    p.add_argument('--step', type=int, default=1, help='render every Nth frame')
    p.add_argument('--only', default='', help='comma list of frames to render')
    p.add_argument('--out', default=DEFAULT_OUT)
    p.add_argument('--samples', type=int, default=0, help='override sample count')
    p.add_argument('--threads', type=int, default=0)
    p.add_argument('--save-blend', default='', help='write the built scene to this .blend')
    p.add_argument('--no-render', action='store_true')
    return p.parse_args(argv)


# ---------------------------------------------------------------- scene

def enable_gpu():
    """Use the best Cycles GPU backend on this machine; False means render on CPU.

    SYNERGY_DEVICE=CPU forces the CPU; SYNERGY_DEVICE=METAL (or OPTIX, CUDA,
    HIP, ONEAPI) forces one backend. Otherwise backends are tried in order.
    """
    want = os.environ.get('SYNERGY_DEVICE', '').upper()
    if want == 'CPU':
        return False
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
    except KeyError:
        return False
    for backend in ([want] if want else ['OPTIX', 'CUDA', 'METAL', 'HIP', 'ONEAPI']):
        try:
            prefs.compute_device_type = backend
        except TypeError:
            continue
        prefs.refresh_devices()
        gpus = [d for d in prefs.devices if d.type == backend]
        if gpus:
            for d in prefs.devices:
                d.use = d.type == backend
            print(f'CYCLES DEVICE {backend}: {", ".join(d.name for d in gpus)}', flush=True)
            return True
    return False


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    for coll in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.node_groups):
        for block in list(coll):
            if block.users == 0:
                coll.remove(block)


def new_scene(start, end, quality='preview', samples=0, threads=0):
    """Empty scene on the film timeline, with the film's render look."""
    reset()
    sc = bpy.context.scene
    sc.name = 'Film'
    sc.frame_start, sc.frame_end = start, end
    sc.render.fps = FPS
    w, h, spp, thresh, blur, prefilter = QUALITY[quality]
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.resolution_percentage = 100
    sc.render.engine = 'CYCLES'
    cy = sc.cycles
    cy.device = 'GPU' if enable_gpu() else 'CPU'
    cy.samples = samples or spp
    cy.use_adaptive_sampling = True
    cy.adaptive_threshold = thresh
    cy.adaptive_min_samples = max(4, (samples or spp) // 4)
    cy.use_denoising = True
    cy.denoiser = 'OPENIMAGEDENOISE'
    cy.denoising_input_passes = 'RGB_ALBEDO_NORMAL'
    cy.denoising_prefilter = prefilter
    if hasattr(cy, 'denoising_quality'):
        cy.denoising_quality = 'HIGH' if quality in ('final', 'hero') else 'BALANCED'
    cy.use_animated_seed = True
    cy.max_bounces = 6
    cy.diffuse_bounces = 3
    cy.glossy_bounces = 3
    cy.transmission_bounces = 6
    cy.volume_bounces = 1
    cy.transparent_max_bounces = 8
    cy.caustics_reflective = False
    cy.caustics_refractive = False
    cy.sample_clamp_indirect = 10.0
    cy.blur_glossy = 1.0
    cy.use_light_tree = True
    sc.render.film_transparent = False
    sc.render.filter_size = 1.5
    sc.render.use_persistent_data = True
    if threads:
        sc.render.threads_mode = 'FIXED'
        sc.render.threads = threads
    sc.render.use_motion_blur = blur
    sc.render.motion_blur_shutter = 0.5
    vs = sc.view_settings
    sc.display_settings.display_device = 'sRGB'
    vs.view_transform = 'AgX'
    vs.look = 'AgX - Medium High Contrast'
    vs.exposure = 0.0
    vs.gamma = 1.0
    img = sc.render.image_settings
    img.file_format = 'PNG'
    img.color_mode = 'RGB'
    img.color_depth = '8'
    img.compression = 15
    world = bpy.data.worlds.new('World')
    world.use_nodes = True
    sc.world = world
    set_world_color((0.0, 0.0, 0.0), 0.0)
    return sc


def set_world_color(rgb, strength):
    nt = bpy.context.scene.world.node_tree
    bg = nt.nodes['Background']
    bg.inputs['Color'].default_value = (*rgb, 1.0)
    bg.inputs['Strength'].default_value = strength
    return bg


def collection(name, parent=None):
    coll = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    parent = parent or bpy.context.scene.collection
    if coll.name not in parent.children:
        parent.children.link(coll)
    return coll


def link(obj, coll=None):
    coll = coll or bpy.context.scene.collection
    for c in obj.users_collection:
        c.objects.unlink(obj)
    coll.objects.link(obj)
    return obj


def mesh_object(name, mesh, coll=None, mat=None, location=(0, 0, 0)):
    obj = bpy.data.objects.new(name, mesh)
    (coll or bpy.context.scene.collection).objects.link(obj)
    obj.location = location
    if mat is not None:
        obj.data.materials.append(mat)
    return obj


def empty(name, coll=None, location=(0, 0, 0), display='PLAIN_AXES', size=0.1):
    obj = bpy.data.objects.new(name, None)
    obj.empty_display_type = display
    obj.empty_display_size = size
    obj.location = location
    (coll or bpy.context.scene.collection).objects.link(obj)
    return obj


def smooth(obj, angle=35.0):
    """Shade smooth with auto smooth by angle (Blender 4.1+ modifier route)."""
    mesh = obj.data
    for poly in mesh.polygons:
        poly.use_smooth = True
    try:
        mesh.set_sharp_from_angle(angle=math.radians(angle))
    except AttributeError:
        pass
    return obj


def bevel(obj, width=0.004, segments=2, angle=40.0, harden=True):
    m = obj.modifiers.new('Bevel', 'BEVEL')
    m.width = width
    m.segments = segments
    m.limit_method = 'ANGLE'
    m.angle_limit = math.radians(angle)
    m.harden_normals = harden
    return m


# ---------------------------------------------------------------- camera

def camera(name='Camera', lens=50.0, location=(0, -5, 1.5), target=None, sensor=36.0,
           fstop=0.0, focus=None, clip=(0.01, 2000.0)):
    """Create the scene camera. fstop>0 enables depth of field; focus is an object or a distance."""
    data = bpy.data.cameras.new(name)
    data.lens = lens
    data.sensor_width = sensor
    data.clip_start, data.clip_end = clip
    cam = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(cam)
    cam.location = location
    if target is not None:
        look_at(cam, target)
    if fstop > 0:
        data.dof.use_dof = True
        data.dof.aperture_fstop = fstop
        data.dof.aperture_blades = 7
        data.dof.aperture_rotation = math.radians(12)
        if isinstance(focus, bpy.types.Object):
            data.dof.focus_object = focus
        elif focus is not None:
            data.dof.focus_distance = focus
    bpy.context.scene.camera = cam
    return cam


def look_at(obj, target, roll=0.0):
    target = Vector(target.location if isinstance(target, bpy.types.Object) else target)
    direction = target - obj.location
    quat = direction.to_track_quat('-Z', 'Y')
    obj.rotation_mode = 'XYZ'
    obj.rotation_euler = quat.to_euler()
    if roll:
        obj.rotation_euler.rotate_axis('Z', math.radians(roll))
    return obj.rotation_euler.copy()


def track_to(obj, target):
    """Constraint-based aim; animate the target instead of the rotation."""
    c = obj.constraints.new('TRACK_TO')
    c.target = target
    c.track_axis = 'TRACK_NEGATIVE_Z'
    c.up_axis = 'UP_Y'
    return c


# ---------------------------------------------------------------- animation

def key(obj, path, frame, value=None, index=-1, interp='BEZIER', easing='AUTO', handle='AUTO_CLAMPED'):
    """Insert a keyframe, optionally setting the value first, and style it."""
    if value is not None:
        target = obj
        attr = path
        if '.' in path:
            *chain, attr = path.split('.')
            for part in chain:
                target = getattr(target, part)
        if index >= 0:
            getattr(target, attr)[index] = value
        else:
            setattr(target, attr, value)
    obj.keyframe_insert(data_path=path, frame=frame, index=index)
    style_last_keys(obj, path, frame, interp, easing, handle)


def style_last_keys(obj, path, frame, interp='BEZIER', easing='AUTO', handle='AUTO_CLAMPED'):
    ad = obj.animation_data if hasattr(obj, 'animation_data') else None
    if ad is None or ad.action is None:
        return
    for fc in fcurves(ad.action):
        if fc.data_path != path:
            continue
        for kp in fc.keyframe_points:
            if abs(kp.co.x - frame) < 1e-4:
                kp.interpolation = interp
                kp.easing = easing
                kp.handle_left_type = handle
                kp.handle_right_type = handle


def fcurves(action):
    """F-curves of an action (works with 4.4+ layered actions and older ones)."""
    if hasattr(action, 'fcurves') and len(action.fcurves):
        return list(action.fcurves)
    out = []
    for layer in getattr(action, 'layers', []):
        for strip in layer.strips:
            for bag in getattr(strip, 'channelbags', []):
                out.extend(bag.fcurves)
    return out


def linear_extrapolate(obj):
    ad = obj.animation_data
    if ad and ad.action:
        for fc in fcurves(ad.action):
            fc.extrapolation = 'LINEAR'


def ease(t, kind='inout'):
    """Smootherstep-family easing on 0..1."""
    t = min(1.0, max(0.0, t))
    if kind == 'in':
        return t * t * t
    if kind == 'out':
        return 1 - (1 - t) ** 3
    if kind == 'linear':
        return t
    return t * t * t * (t * (6 * t - 15) + 10)


def lerp(a, b, t):
    if isinstance(a, (tuple, list, Vector)):
        return Vector(a).lerp(Vector(b), t)
    return a + (b - a) * t


def bake_path(obj, frames, fn, path='location'):
    """Keyframe obj.<path> = fn(frame) on every frame in `frames` (linear keys)."""
    for f in frames:
        setattr(obj, path, fn(f))
        obj.keyframe_insert(data_path=path, frame=f)
    ad = obj.animation_data
    if ad and ad.action:
        for fc in fcurves(ad.action):
            if fc.data_path == path:
                for kp in fc.keyframe_points:
                    kp.interpolation = 'LINEAR'


def seconds(t):
    """Film seconds -> film frame number (frame 1 is t=0)."""
    return int(round(t * FPS)) + 1


# ---------------------------------------------------------------- lights

def area_light(name, location, target=None, energy=500.0, size=1.0, size_y=None, color=(1, 1, 1),
               shape='RECTANGLE', spread=180.0, coll=None):
    data = bpy.data.lights.new(name, 'AREA')
    data.energy = energy
    data.color = color
    data.shape = shape
    data.size = size
    data.size_y = size_y if size_y is not None else size
    data.spread = math.radians(spread)
    obj = bpy.data.objects.new(name, data)
    (coll or bpy.context.scene.collection).objects.link(obj)
    obj.location = location
    if target is not None:
        look_at(obj, target)
    return obj


def spot_light(name, location, target=None, energy=1000.0, size_deg=40.0, blend=0.3, radius=0.05,
               color=(1, 1, 1), coll=None):
    data = bpy.data.lights.new(name, 'SPOT')
    data.energy = energy
    data.color = color
    data.spot_size = math.radians(size_deg)
    data.spot_blend = blend
    data.shadow_soft_size = radius
    obj = bpy.data.objects.new(name, data)
    (coll or bpy.context.scene.collection).objects.link(obj)
    obj.location = location
    if target is not None:
        look_at(obj, target)
    return obj


def point_light(name, location, energy=100.0, radius=0.05, color=(1, 1, 1), coll=None):
    data = bpy.data.lights.new(name, 'POINT')
    data.energy = energy
    data.color = color
    data.shadow_soft_size = radius
    obj = bpy.data.objects.new(name, data)
    (coll or bpy.context.scene.collection).objects.link(obj)
    obj.location = location
    return obj


def sun_light(name, rotation_deg=(50, 0, 30), energy=3.0, angle_deg=1.0, color=(1, 1, 1), coll=None):
    data = bpy.data.lights.new(name, 'SUN')
    data.energy = energy
    data.color = color
    data.angle = math.radians(angle_deg)
    obj = bpy.data.objects.new(name, data)
    (coll or bpy.context.scene.collection).objects.link(obj)
    obj.rotation_euler = Euler([math.radians(a) for a in rotation_deg])
    return obj


def sky_world(sun_elevation_deg=8.0, sun_rotation_deg=200.0, strength=1.0, air=1.0, dust=1.0, ozone=1.0):
    """Nishita physical sky as the world background."""
    nt = bpy.context.scene.world.node_tree
    nodes, links = nt.nodes, nt.links
    sky = nodes.new('ShaderNodeTexSky')
    sky.sky_type = 'NISHITA'
    sky.sun_elevation = math.radians(sun_elevation_deg)
    sky.sun_rotation = math.radians(sun_rotation_deg)
    sky.air_density = air
    sky.dust_density = dust
    sky.ozone_density = ozone
    sky.sun_disc = True
    bg = nodes['Background']
    links.new(sky.outputs['Color'], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = strength
    return sky


# ---------------------------------------------------------------- compositing

def compositor(glare=0.0, glare_threshold=1.0, glare_size=7, vignette=0.0, mist=None):
    """Bloom/glare, optional depth fog from the mist pass, and a soft vignette.

    mist = dict(color=(r,g,b), start=..., depth=..., amount=0..1) mixes the
    mist pass towards a fog colour (cheap aerial perspective, no volumes).
    """
    sc = bpy.context.scene
    sc.use_nodes = True
    nt = sc.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    rl = nt.nodes.new('CompositorNodeRLayers')
    comp = nt.nodes.new('CompositorNodeComposite')
    cur = rl.outputs['Image']
    if mist:
        vl = sc.view_layers[0]
        vl.use_pass_mist = True
        sc.world.mist_settings.start = mist.get('start', 5.0)
        sc.world.mist_settings.depth = mist.get('depth', 200.0)
        sc.world.mist_settings.falloff = mist.get('falloff', 'QUADRATIC')
        mul = nt.nodes.new('CompositorNodeMath')
        mul.operation = 'MULTIPLY'
        mul.inputs[1].default_value = mist.get('amount', 0.6)
        nt.links.new(rl.outputs['Mist'], mul.inputs[0])
        mix = nt.nodes.new('CompositorNodeMixRGB')
        mix.inputs[2].default_value = (*mist.get('color', (0.7, 0.75, 0.8)), 1)
        nt.links.new(mul.outputs[0], mix.inputs[0])
        nt.links.new(cur, mix.inputs[1])
        cur = mix.outputs[0]
    if glare > 0:
        g = nt.nodes.new('CompositorNodeGlare')
        g.glare_type = 'FOG_GLOW'
        g.quality = 'HIGH'
        g.size = glare_size
        g.threshold = glare_threshold
        g.mix = -1.0 + glare  # -1 = input only, 0 = even mix
        if 'Strength' in g.inputs:  # Blender 4.5: settings live on input sockets
            g.inputs['Threshold'].default_value = glare_threshold
            g.inputs['Strength'].default_value = glare
            g.inputs['Size'].default_value = min(1.0, 0.06 * glare_size + 0.03)
        nt.links.new(cur, g.inputs['Image'])
        cur = g.outputs['Image']
    if vignette > 0:
        mask = nt.nodes.new('CompositorNodeEllipseMask')
        mask.width, mask.height = 1.1, 1.05
        blur = nt.nodes.new('CompositorNodeBlur')
        blur.filter_type = 'GAUSS'
        blur.use_relative = True
        blur.factor_x = blur.factor_y = 0.35
        if 'Size' in mask.inputs:  # Blender 4.5: mask size and blur radius are sockets
            mask.inputs['Size'].default_value = (1.1, 1.05)
            w = sc.render.resolution_x * sc.render.resolution_percentage / 100.0
            h = sc.render.resolution_y * sc.render.resolution_percentage / 100.0
            blur.inputs['Size'].default_value = (0.35 * w, 0.35 * h)
        nt.links.new(mask.outputs['Mask'], blur.inputs['Image'])
        mix = nt.nodes.new('CompositorNodeMixRGB')
        mix.blend_type = 'MULTIPLY'
        mix.inputs['Fac'].default_value = vignette
        inv = nt.nodes.new('CompositorNodeMath')
        inv.operation = 'MAXIMUM'
        inv.inputs[1].default_value = 0.0
        nt.links.new(blur.outputs['Image'], inv.inputs[0])
        nt.links.new(cur, mix.inputs[1])
        nt.links.new(inv.outputs[0], mix.inputs[2])
        cur = mix.outputs[0]
    nt.links.new(cur, comp.inputs['Image'])
    return nt


# ---------------------------------------------------------------- render

def frame_list(args, start, end):
    if args.only:
        frames = [int(f) for f in args.only.split(',') if f]
    else:
        a, b = start, end
        if args.frames:
            a, b = (int(x) for x in args.frames.split('-'))
            a, b = max(a, start), min(b, end)
        frames = list(range(a, b + 1, max(1, args.step)))
    return [f for f in frames if start <= f <= end]


def render(shot_id, args, start, end):
    """Render the requested frames of the current scene to <out>/<shot_id>/NNNN.png."""
    sc = bpy.context.scene
    if args.save_blend:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(args.save_blend))
    if args.no_render:
        return []
    out_dir = os.path.join(os.path.abspath(args.out), shot_id)
    os.makedirs(out_dir, exist_ok=True)
    done = []
    for f in frame_list(args, start, end):
        path = os.path.join(out_dir, f'{f:04d}.png')
        sc.frame_set(f)
        sc.render.filepath = path
        bpy.ops.render.render(write_still=True)
        print(f'RENDERED {shot_id} {f} {path}', flush=True)
        done.append(path)
    return done
