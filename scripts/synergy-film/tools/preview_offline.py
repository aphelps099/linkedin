"""Render E1_OFFLINE test frames for the named framings.

    blender -b -P tools/preview_offline.py -- --quality proof --out DIR
    blender -b -P tools/preview_offline.py -- --quality final --shots s08_poster --out DIR --profile

Framings (film frame in brackets):
    s01_glide (60)      low glide over the espresso toward the backlit arch, 21 mm, foam floes past the lens
    s01_slot (128)      slot centred, long axis horizontal, 20% of frame width (S02 match cut), 43.7 mm
    s06_land (556)      50 mm, 75 m out: the hero padlock just landed on the scree, dust rising
    s06_arch (600)      50 mm, 55 m out, end of the tilt: the slot-sun inside the padlock arch
    s08_poster (832)    the whole world from the south shore, 30 m up, 18 mm: arch, atoll, island, terraces, falls
    s12_fireflies (1217) night, 1.5 m above a low paddy (south-west flank), 35 mm f/2.8: the unison flash
    s14_box (1393)      night, 340 m up the beam above the box, 21 mm, world tilted ~10 degrees, on a firefly flash

Each framing is built from nothing in its own scene (only the parts it sees)
and written to <out>/<name>.png. Samples follow env_offline.OFFLINE_SPP for
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
    p.add_argument('--threads', type=int, default=0)
    p.add_argument('--percent', type=int, default=100, help='resolution percentage')
    p.add_argument('--frame', type=int, default=0, help='override the framing frame')
    p.add_argument('--save-blend', default='')
    p.add_argument('--no-render', action='store_true')
    p.add_argument('--grass', type=int, default=52000)
    p.add_argument('--profile', action='store_true', help='print render phase times')
    return p.parse_args(argv)


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
    f = a.frame or fr['frame']
    t0 = time.time()
    sc = C.new_scene(f, f, a.quality, a.samples, a.threads)
    sc.render.resolution_percentage = a.percent
    h = E.build_offline(fr['state'], include=fr['include'], frames=(f, f), grass_count=a.grass, **E.build_kwargs(fr))
    E.tune_render(sc, a.quality, a.samples)
    if 'gravity' in fr:
        fa, da, fb, db = fr['gravity']
        E.set_gravity(h, fa, da)
        E.set_gravity(h, fb, db)
    if 'hero_padlock' in h['objects']:
        E.animate_hero_padlock(h)
    E.apply_fills(h, fr.get('fills'))
    E.camera_offline(fr['lens'], fr['location'], fr['target'], fstop=fr.get('fstop', 0.0), focus=fr.get('focus'),
                     roll=fr.get('roll', 0.0))
    E.set_shaft_camera(h, fr.get('shaft_camera', True))
    E.apply_look(fr['state'], **fr.get('look', {}))
    sc.frame_set(f)
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
    os.makedirs(a.out, exist_ok=True)
    for name in [s for s in a.shots.split(',') if s]:
        render_one(name, a)


main()
