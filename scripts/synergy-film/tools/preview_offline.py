"""Render E1_OFFLINE test frames for the named framings.

    blender -b -P tools/preview_offline.py -- --quality proof --out DIR
    blender -b -P tools/preview_offline.py -- --quality final --shots s08_poster --out DIR --profile

Framings (film frame in brackets):
    s01_glide (60)      low glide over the espresso toward the backlit arch, 19 mm, foam floes past the lens
    s01_slot (128)      the S01/S02 cut frame: slot centred, long axis horizontal, 20% of frame width, 43.7 mm,
                        eclipsed by the fingertips and envelope (a thin even rim of sky)
    s06_land (556)      50 mm, 75 m out: the hero padlock just landed on the scree, dust rising
    s06_arch (600)      50 mm, 55 m out, end of the tilt: the slot-sun inside the padlock arch
    s08_poster (832)    the whole world from a wet-stone shelf on the south shore, 10 m up, 14 mm: slot and vault,
                        arch, murmuration, atoll, island, falls, terraces
    s12_fireflies (1217) night, 1.5 m above a low paddy (south-west flank), 30 mm f/2.8: the unison flash
    s14_box (1393)      night, 340 m up the beam above the box, 18 mm, world tilted ~10 degrees, on a firefly flash

Each framing is built from nothing in its own scene (only the parts it sees)
and written to <out>/<name>.png. --border renders a cropped region only (for
noise and boil tests), --prune-cache N trims the Offline cache directory to the
newest N files per kind. Samples follow env_offline.OFFLINE_SPP for
the quality (unless --samples). Build and render times, CPU seconds and the
load average before and after are appended to <out>/timings.txt; a timing
taken with the load above 5 is flagged unreliable, because CPU time inflates
under contention. --profile also splits the render into its phases (scene
sync and BVH, light tree, sampling, denoise, compositor) from Blender's
render-stats messages.
"""

import argparse
import os
import resource
import sys
import time

import bpy

LIB = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'lib')
sys.path.insert(0, LIB)
import common as C  # noqa: E402
import env_offline as E  # noqa: E402

ALL = ('s01_glide', 's01_slot', 's06_arch', 's08_poster', 's12_fireflies', 's14_box')
EXTRA = ('s06_land',)


def args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument('--quality', default='proof', choices=sorted(C.QUALITY))
    p.add_argument('--out', required=True)
    p.add_argument('--shots', default=','.join(ALL), help=f'comma list of {ALL + EXTRA}')
    p.add_argument('--samples', type=int, default=0)
    p.add_argument('--threshold', type=float, default=0.0, help='adaptive sampling threshold override')
    p.add_argument('--fixed-seed', action='store_true', help='turn the animated seed off (boil tests)')
    p.add_argument('--bounces', default='', help='diffuse,glossy,transmission bounce override (cost tests)')
    p.add_argument('--exclude', default='', help='comma list of parts to leave out of the framing (cost tests)')
    p.add_argument('--threads', type=int, default=0)
    p.add_argument('--percent', type=int, default=100, help='resolution percentage')
    p.add_argument('--frame', type=int, default=0, help='override the framing frame')
    p.add_argument('--save-blend', default='')
    p.add_argument('--no-render', action='store_true')
    p.add_argument('--grass', type=int, default=52000)
    p.add_argument('--profile', action='store_true', help='print render phase times')
    p.add_argument('--border', default='', help='render only this region: x0,y0,x1,y1 as frame fractions (cropped)')
    p.add_argument('--prune-cache', type=int, default=0,
                   help='keep only the newest N files per cache prefix in the Offline cache dir, then exit')
    return p.parse_args(argv)


def prune_cache(keep, cache_dir=None):
    """Delete all but the newest `keep` files of each kind (prefix before the first '_') in the cache."""
    cache_dir = cache_dir or E.CACHE_DIR
    groups = {}
    for fn in os.listdir(cache_dir):
        fp = os.path.join(cache_dir, fn)
        if os.path.isfile(fp):
            groups.setdefault(fn.split('_')[0], []).append(fp)
    freed = 0
    for prefix, files in groups.items():
        files.sort(key=os.path.getmtime, reverse=True)
        for fp in files[keep:]:
            freed += os.path.getsize(fp)
            os.remove(fp)
    print(f'PRUNE kept {keep} per prefix in {cache_dir}, freed {freed / 1e6:.0f} MB', flush=True)


class Phases:
    """Collect (time, stats) from render_stats and split the render into phases."""

    def __init__(self):
        self.events = []
        bpy.app.handlers.render_stats.append(self.on_stats)

    def on_stats(self, stats, *rest):
        self.events.append((time.time(), str(stats)))

    def close(self):
        if self.on_stats in bpy.app.handlers.render_stats:
            bpy.app.handlers.render_stats.remove(self.on_stats)

    def summary(self, t0, t_end):
        def first(*keys):
            for t, s in self.events:
                if any(k in s for k in keys):
                    return t
            return None

        def last(*keys):
            hit = None
            for t, s in self.events:
                if any(k in s for k in keys):
                    hit = t
            return hit
        t_tree = first('light tree', 'Light Tree', 'Computing tree')
        t_samp = first('Sample ')
        t_samp_end = last('Sample ')
        t_den = first('Denois')
        t_comp = first('Compositing')
        out = []
        marks = [('sync+bvh', t0, t_tree or t_samp), ('light tree', t_tree, t_samp), ('sampling', t_samp, t_den or t_samp_end),
                 ('denoise', t_den, t_comp), ('composite', t_comp, t_end)]
        for name, a, b in marks:
            if a is not None and b is not None and b >= a:
                out.append(f'{name} {b - a:.1f}s')
        return ', '.join(out)


def render_one(name, a):
    fr = E.framing(name)
    if a.exclude:
        fr['include'] = set(fr['include']) - set(a.exclude.split(','))
    f = a.frame or fr['frame']
    t0 = time.time()
    sc = C.new_scene(f, f, a.quality, a.samples, a.threads)
    sc.render.resolution_percentage = a.percent
    h = E.build_offline(fr['state'], include=fr['include'], frames=(f, f), grass_count=a.grass, **E.build_kwargs(fr))
    E.tune_render(sc, a.quality, a.samples)
    if a.threshold:
        sc.cycles.adaptive_threshold = a.threshold
    if a.fixed_seed:
        sc.cycles.use_animated_seed = False
    if a.bounces:
        sc.cycles.diffuse_bounces, sc.cycles.glossy_bounces, sc.cycles.transmission_bounces = \
            (int(v) for v in a.bounces.split(','))
    if 'gravity' in fr:
        fa, da, fb, db = fr['gravity']
        E.set_gravity(h, fa, da)
        E.set_gravity(h, fb, db)
    if 'hero_padlock' in h['objects']:
        E.animate_hero_padlock(h)
    if fr.get('eclipse'):
        E.build_eclipse(h)                    # the true S01/S02 cut frame (f125-128)
    E.apply_fills(h, fr.get('fills'))
    E.apply_values(h, fr.get('values'))
    E.apply_light_levels(h, fr.get('lights'))
    E.camera_offline(fr['lens'], fr['location'], fr['target'], fstop=fr.get('fstop', 0.0), focus=fr.get('focus'),
                     roll=fr.get('roll', 0.0))
    E.set_shaft_camera(h, fr.get('shaft_camera', True))
    E.apply_look(fr['state'], **fr.get('look', {}))
    sc.frame_set(f)
    if a.border:
        x0, y0, x1, y1 = (float(v) for v in a.border.split(','))
        sc.render.use_border = True
        sc.render.use_crop_to_border = True
        sc.render.border_min_x, sc.render.border_min_y, sc.render.border_max_x, sc.render.border_max_y = x0, y0, x1, y1
    t_build = time.time() - t0
    if a.save_blend:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(a.out, name + '.blend'))
    t_render = 0.0
    cpu = 0.0
    load0 = os.getloadavg()[0]
    phases = ''
    if not a.no_render:
        sc.render.filepath = os.path.join(os.path.abspath(a.out), name + '.png')
        ph = Phases() if a.profile else None
        t1 = time.time()
        c1 = resource.getrusage(resource.RUSAGE_SELF)
        bpy.ops.render.render(write_still=True)
        c2 = resource.getrusage(resource.RUSAGE_SELF)
        t_render = time.time() - t1
        cpu = (c2.ru_utime - c1.ru_utime) + (c2.ru_stime - c1.ru_stime)
        if ph:
            phases = ph.summary(t1, t1 + t_render)
            ph.close()
    load1 = os.getloadavg()[0]
    # idle-machine estimate: CPU seconds spread over the machine's cores (inflated under contention)
    idle = cpu / max(1, os.cpu_count() or 4)
    flag = '' if max(load0, load1) <= 5.0 else ' UNRELIABLE(load>5)'
    line = f'{name} frame {f} quality {a.quality} spp {sc.cycles.samples} ' \
           f'{sc.render.resolution_x}x{sc.render.resolution_y}@{a.percent}% build {t_build:.1f}s ' \
           f'render {t_render:.1f}s cpu {cpu:.1f}s idle-est {idle:.1f}s load {load0:.2f}->{load1:.2f}{flag}'
    if phases:
        line += f' | {phases}'
    print('PREVIEW', line, flush=True)
    with open(os.path.join(a.out, 'timings.txt'), 'a') as fh:
        fh.write(line + '\n')


def main():
    a = args()
    if a.prune_cache:
        prune_cache(a.prune_cache)
        return
    os.makedirs(a.out, exist_ok=True)
    for name in [s for s in a.shots.split(',') if s]:
        render_one(name, a)


main()
