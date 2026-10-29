"""Render E1_OFFLINE test frames for the named framings.

    blender -b -P tools/preview_offline.py -- --quality proof --out DIR
    blender -b -P tools/preview_offline.py -- --quality final --shots s08_poster --out DIR

Framings (film frame in brackets):
    s01_glide (60)      low glide over the espresso toward the arch, 21mm
    s01_slot (128)      slot centred, long axis horizontal, 20% of frame width (S02 match cut)
    s06_arch (600)      worm's-eye up through the padlock arch to the slot-sun, hero padlock at rest
    s08_poster (832)    the whole world: arch, atoll, falls, terraces, murmuration, box in the shaft
    s12_fireflies (1217) night, 1.5 m above a terrace mirror, the unison flash
    s14_box (1390)      night, high on the beam above the box, world tilted ~10 degrees

Each framing is built from nothing in its own scene (only the parts it sees)
and written to <out>/<name>.png; build and render times are printed and
appended to <out>/timings.txt.
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


def args():
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    p = argparse.ArgumentParser()
    p.add_argument('--quality', default='proof', choices=sorted(C.QUALITY))
    p.add_argument('--out', required=True)
    p.add_argument('--shots', default=','.join(ALL))
    p.add_argument('--samples', type=int, default=0)
    p.add_argument('--threads', type=int, default=0)
    p.add_argument('--percent', type=int, default=100, help='resolution percentage')
    p.add_argument('--save-blend', default='')
    p.add_argument('--no-render', action='store_true')
    p.add_argument('--grass', type=int, default=52000)
    return p.parse_args(argv)


def render_one(name, a):
    fr = E.framing(name)
    f = fr['frame']
    t0 = time.time()
    sc = C.new_scene(f, f, a.quality, a.samples, a.threads)
    sc.render.resolution_percentage = a.percent
    h = E.build_offline(fr['state'], include=fr['include'], frames=(f, f), sea_focus=fr.get('sea_focus'),
                        blooms=fr.get('blooms'), grey_near=fr.get('grey_near'), grass_count=a.grass)
    if 'gravity' in fr:
        fa, da, fb, db = fr['gravity']
        E.set_gravity(h, fa, da)
        E.set_gravity(h, fb, db)
    if 'hero_padlock' in h['objects']:
        E.animate_hero_padlock(h)
    E.camera_offline(fr['lens'], fr['location'], fr['target'], fstop=fr.get('fstop', 0.0), focus=fr.get('focus'))
    E.apply_look(fr["state"])
    sc.frame_set(f)
    t_build = time.time() - t0
    if a.save_blend:
        bpy.ops.wm.save_as_mainfile(filepath=os.path.join(a.out, name + '.blend'))
    t_render = 0.0
    cpu = 0.0
    if not a.no_render:
        sc.render.filepath = os.path.join(os.path.abspath(a.out), name + '.png')
        t1 = time.time()
        c1 = resource.getrusage(resource.RUSAGE_SELF)
        bpy.ops.render.render(write_still=True)
        c2 = resource.getrusage(resource.RUSAGE_SELF)
        t_render = time.time() - t1
        cpu = (c2.ru_utime - c1.ru_utime) + (c2.ru_stime - c1.ru_stime)
    else:
        cpu = 0.0
    # idle-machine estimate: CPU seconds spread over the machine's cores
    idle = cpu / max(1, os.cpu_count() or 4)
    line = f'{name} frame {f} quality {a.quality} {sc.render.resolution_x}x{sc.render.resolution_y}@{a.percent}% ' \
           f'build {t_build:.1f}s render {t_render:.1f}s cpu {cpu:.1f}s idle-est {idle:.1f}s load {os.getloadavg()[0]:.2f}'
    print('PREVIEW', line, flush=True)
    with open(os.path.join(a.out, 'timings.txt'), 'a') as fh:
        fh.write(line + '\n')


def main():
    a = args()
    os.makedirs(a.out, exist_ok=True)
    for name in [s for s in a.shots.split(',') if s]:
        render_one(name, a)


main()
