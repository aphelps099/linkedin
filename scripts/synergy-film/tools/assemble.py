#!/usr/bin/env python3
"""Cut the film: stitch rendered frames on the 1440-frame timeline and mux the mix.

    python3 tools/assemble.py --audio out/mix.wav --out out/Synergy-Offline.mp4

For every film frame it takes the best render available (final, then
preview, then proof, then animatic), so a cut can be watched while finals
are still rendering. Missing frames become black. Frames are scaled to
1920x1080 (Lanczos) and given a light, temporally varying film grain.
"""

import argparse
import json
import os
import shutil
import subprocess
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DEFAULT_SHOTS = os.path.join(ROOT, 'shots', 'shots.json')
TIERS = ('hero', 'final', 'preview', 'proof', 'animatic')


def pick(frames_root, shot, frame, tiers):
    for tier in tiers:
        path = os.path.join(frames_root, tier, shot, f'{frame:04d}.png')
        if os.path.exists(path):
            return path, tier
    return None, None


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--frames', default=os.environ.get('SYNERGY_OUT', os.path.join(ROOT, 'out')))
    p.add_argument('--audio', default='')
    p.add_argument('--out', required=True)
    p.add_argument('--tiers', default=','.join(TIERS))
    p.add_argument('--grain', type=float, default=3.0, help='0 disables grain')
    p.add_argument('--crf', type=int, default=14)
    p.add_argument('--start', type=int, default=1)
    p.add_argument('--end', type=int, default=0, help='last frame (default: the end of the last shot)')
    p.add_argument('--shots-json', default=DEFAULT_SHOTS, help='shot list of the film or episode to cut')
    p.add_argument('--hold', action='store_true', help='fill missing frames with the last available frame')
    args = p.parse_args()
    SHOTS = json.load(open(args.shots_json))
    args.end = args.end or max(s['end'] for s in SHOTS)

    tiers = [t for t in args.tiers.split(',') if t]
    tmp = tempfile.mkdtemp(prefix='synergy_seq_')
    black = os.path.join(tmp, 'black.png')
    subprocess.run(['ffmpeg', '-v', 'error', '-f', 'lavfi', '-i', 'color=c=black:s=1920x1080',
                    '-frames:v', '1', black], check=True)
    used = {}
    last = black
    n = 0
    for shot in SHOTS:
        for f in range(max(shot['start'], args.start), min(shot['end'], args.end) + 1):
            src, tier = pick(args.frames, shot['id'], f, tiers)
            if src is None:
                src = last if args.hold else black
                tier = 'missing'
            used[tier] = used.get(tier, 0) + 1
            n += 1
            os.symlink(os.path.abspath(src), os.path.join(tmp, f'{n:05d}.png'))
            last = src
    print('frames by tier:', used, flush=True)

    vf = ['scale=1920:1080:flags=lanczos', 'format=yuv444p']
    if args.grain > 0:
        vf.append(f'noise=c0s={args.grain}:c0f=t+u:c1s={args.grain / 3:.2f}:c1f=t+u:c2s={args.grain / 3:.2f}:c2f=t+u')
    vf.append('format=yuv420p')
    cmd = ['ffmpeg', '-y', '-v', 'error', '-framerate', '24', '-i', os.path.join(tmp, '%05d.png')]
    if args.audio:
        cmd += ['-i', args.audio]
    cmd += ['-vf', ','.join(vf), '-c:v', 'libx264', '-preset', 'slow', '-crf', str(args.crf),
            '-profile:v', 'high', '-tune', 'film', '-movflags', '+faststart', '-r', '24']
    if args.audio:
        cmd += ['-c:a', 'aac', '-b:a', '320k', '-ar', '48000', '-shortest']
    cmd += [args.out]
    subprocess.run(cmd, check=True)
    shutil.rmtree(tmp)
    print('wrote', args.out, flush=True)


if __name__ == '__main__':
    main()
