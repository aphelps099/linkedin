#!/usr/bin/env python3
"""Render queue for the film: runs shot scripts in Blender, resuming where it left off.

    python3 tools/render_all.py --quality final                 # every shot
    python3 tools/render_all.py --quality animatic --shots s03,s04 --step 2

Frames land in <out>/<quality>/<shot>/NNNN.png on the film timeline. A frame
that already exists is skipped, so the queue can be stopped and restarted.
One Blender process renders a whole shot (persistent data keeps BVH builds
cheap); shots run one after another so each gets all cores.
"""

import argparse
import glob
import json
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SHOTS = json.load(open(os.path.join(ROOT, 'shots', 'shots.json')))


def missing_frames(out_dir, start, end, step):
    want = list(range(start, end + 1, step))
    if step > 1 and want[-1] != end:
        want.append(end)
    return [f for f in want if not os.path.exists(os.path.join(out_dir, f'{f:04d}.png'))]


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--quality', default='animatic')
    p.add_argument('--shots', default='')
    p.add_argument('--step', type=int, default=1)
    p.add_argument('--out', default=os.environ.get('SYNERGY_OUT', os.path.join(ROOT, 'out')))
    p.add_argument('--blender', default=os.environ.get('BLENDER', 'blender'))
    p.add_argument('--chunk', type=int, default=48, help='frames per Blender process')
    args = p.parse_args()

    wanted = [s for s in args.shots.split(',') if s] or [s['id'] for s in SHOTS]
    log_path = os.path.join(args.out, args.quality, 'render_log.jsonl')
    os.makedirs(os.path.dirname(log_path), exist_ok=True)
    for shot in SHOTS:
        if shot['id'] not in wanted:
            continue
        out_dir = os.path.join(args.out, args.quality, shot['id'])
        todo = missing_frames(out_dir, shot['start'], shot['end'], args.step)
        if not todo:
            print(f"{shot['id']}: complete", flush=True)
            continue
        script = os.path.join(ROOT, 'shots', shot['script'])
        for i in range(0, len(todo), args.chunk):
            batch = todo[i:i + args.chunk]
            cmd = [args.blender, '-b', '--factory-startup', '-P', script, '--',
                   '--quality', args.quality, '--out', os.path.join(args.out, args.quality),
                   '--only', ','.join(map(str, batch))]
            t0 = time.time()
            print(f"{shot['id']}: rendering {len(batch)} frames ({batch[0]}..{batch[-1]})", flush=True)
            proc = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
            dt = time.time() - t0
            done = [f for f in batch if os.path.exists(os.path.join(out_dir, f'{f:04d}.png'))]
            with open(log_path, 'a') as fh:
                fh.write(json.dumps({'shot': shot['id'], 'frames': len(batch), 'done': len(done),
                                     'seconds': round(dt, 1), 'per_frame': round(dt / max(1, len(done)), 1),
                                     'returncode': proc.returncode}) + '\n')
            print(f"{shot['id']}: {len(done)}/{len(batch)} in {dt:.0f}s ({dt / max(1, len(done)):.1f}s/frame)", flush=True)
            if proc.returncode != 0 or len(done) < len(batch):
                tail = '\n'.join(proc.stdout.splitlines()[-40:])
                print(f"{shot['id']}: FAILED\n{tail}", flush=True)
                break


if __name__ == '__main__':
    sys.exit(main())
