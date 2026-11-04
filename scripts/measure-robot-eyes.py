"""Mark where Synergy blinks in each tracked studio shot: robot-tracks.json gets `blinks`,
[[from, to], ...] inclusive source-frame spans where either LED eye is dark. A held frame
(a freeze, the tape stop's hold) should never land in one: drop60-draft.js picks its
closing hold from them.

The eyes sit where the track puts them (scripts/track-studio-robots.py): the mouth row's
anchor is a fixed offset from the eyes' midpoint, so each eye is at
  mouth - R(angle) . ANCHOR . scale  +/-  R(angle) . (35, 0) . scale
in source px (the eye distance is 70 . scale). An eye is lit when its window holds at least
half the shot's median count of the tracker's own green-LED pixels; a blink is a run of
frames with either eye under that. Only adds the field: the frames are left as they are.

Needs ffmpeg and numpy:  python3 -I scripts/measure-robot-eyes.py
Reads the 540p proxies from public/videostudio/proxies/ (build-videostudio-proxies.mjs).
"""
from pathlib import Path
import json, subprocess
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
TRACKS = ROOT / 'src/videostudio/media/robot-tracks.json'
SHOTS = json.loads((ROOT / 'src/videostudio/media/shots.json').read_text())
SHOTS = {s['id']: s for s in (SHOTS['shots'] if isinstance(SHOTS, dict) else SHOTS)}
ANCHOR = np.array([4.90, 46.74])   # track-studio-robots.py

def frames_of(shot):
    key = (shot.get('proxy') or '').rsplit('/', 1)[-1]
    path = ROOT / 'public/videostudio/proxies' / key
    if not key or not path.exists(): raise SystemExit(f'{shot["id"]}: no local proxy (run build-videostudio-proxies.mjs)')
    w, h = shot['proxyInfo']['w'], shot['proxyInfo']['h']
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.uint8).reshape(-1, h, w, 3).astype(np.float32), shot['width'] / w

def lit(frames, k, track):
    counts = []
    for im, (x, y, a, s) in zip(frames, track['frames']):
        rot = np.array([[np.cos(a), -np.sin(a)], [np.sin(a), np.cos(a)]])
        mid = np.array([x, y]) - rot @ ANCHOR * s
        r = max(4, int(14 * s / k))
        row = []
        for side in (-1, 1):
            ex, ey = (mid + rot @ np.array([35 * side, 0]) * s) / k
            win = im[max(0, int(ey) - r):int(ey) + r, max(0, int(ex) - r):int(ex) + r]
            R, G, B = win[..., 0], win[..., 1], win[..., 2]
            row.append(int(((G > R * 1.4) & (G > B * 1.3) & (G > 60)).sum()))
        counts.append(row)
    return np.array(counts)

tracks = json.loads(TRACKS.read_text())
for sid, track in tracks.items():
    frames, k = frames_of(SHOTS[sid])
    if len(frames) != len(track['frames']): raise SystemExit(f'{sid}: decoded {len(frames)} frames, the track has {len(track["frames"])}')
    c = lit(frames, k, track)
    dark = (c < .5 * np.median(c, axis=0)).any(axis=1)
    spans, i = [], 0
    while i < len(dark):
        if dark[i]:
            j = i
            while j + 1 < len(dark) and dark[j + 1]: j += 1
            spans.append([i, j]); i = j + 1
        else: i += 1
    track['blinks'] = spans
    print(f'{sid}: {len(spans)} blinks {spans} (median eye {np.median(c, axis=0).tolist()} px)')
TRACKS.write_text(json.dumps(tracks, separators=(',', ':')) + '\n')
print('wrote', TRACKS.relative_to(ROOT))
