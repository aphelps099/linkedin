"""Track Synergy's LED eyes in the studio's footage and place his mouth row the way the
meeting room does (scripts/track-meeting-robots.py): the row sits at a fixed offset from
the eyes' midpoint, rotated with the eye line and scaled by the eye distance / 70.

The meeting room's own plate (synergy-camera-v2-listening) keeps robot-tracking.json; this
adds every other Synergy shot in src/videostudio/media/shots.json whose display is clean
(the LED eyes and no decorative mouth baked into the glass), so the compositor can draw his
mouth row on them too. Output: src/videostudio/media/robot-tracks.json,
{shotId: {robot, fps, frames:[[x, y, angle, scale], ...]}} in the shot's source px, one entry
per source frame, smoothed like the meeting room's.

Needs OpenCV (only to prepare the data):  python -I scripts/track-studio-robots.py
Reads the 540p proxies from public/videostudio/proxies/ (build-videostudio-proxies.mjs).
"""
from pathlib import Path
import json, sys
import cv2, numpy as np
from scipy.signal import savgol_filter

ROOT = Path(__file__).resolve().parents[1]
SHOTS = json.loads((ROOT / 'src/videostudio/media/shots.json').read_text())
SHOTS = SHOTS['shots'] if isinstance(SHOTS, dict) else SHOTS
PROXIES = ROOT / 'public/videostudio/proxies'
# The meeting room's calibration: the speech row's offset from the eyes' midpoint, in units of
# (eye distance / 70), measured on V2 Synergy's first frame (track-meeting-robots.py).
ANCHOR = np.array([4.90, 46.74])
# The meeting room's plate keeps its own track. The original take has a decorative mouth in
# the glass already (the v2 plate is that take cleaned), so nothing is drawn over it.
SKIP = {'synergy-camera-v2-listening', 'synergy-synergy-v2-original-take'}

def proxy_of(shot):
    key = (shot.get('proxy') or '').rsplit('/', 1)[-1]
    p = PROXIES / key
    return p if key and p.exists() else None

def track(shot):
    path = proxy_of(shot)
    if not path: raise SystemExit(f'{shot["id"]}: no local proxy (run build-videostudio-proxies.mjs)')
    cap = cv2.VideoCapture(str(path))
    W, H = shot['width'], shot['height']
    fb = shot['faceBox']
    positions, k = [], None
    while True:
        ok, im = cap.read()
        if not ok: break
        ph, pw = im.shape[:2]
        k = W / pw
        # The glass, padded, in proxy px.
        x0, y0 = int(max(0, (fb['x'] - .3 * fb['w']) / k)), int(max(0, (fb['y'] - .3 * fb['h']) / k))
        x1, y1 = int(min(pw, (fb['x'] + 1.3 * fb['w']) / k)), int(min(ph, (fb['y'] + 1.3 * fb['h']) / k))
        b, g, r = cv2.split(im.astype(float))
        mask = ((g > r * 1.4) & (g > b * 1.3) & (g > 60)).astype('uint8')
        keep = np.zeros_like(mask); keep[y0:y1, x0:x1] = 1; mask &= keep
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((3, 5), np.uint8))
        _, _, stats, centers = cv2.connectedComponentsWithStats(mask)
        floor = max(6, fb['w'] * fb['h'] / k / k * .0015)
        eyes = sorted([(s, c) for s, c in zip(stats[1:], centers[1:]) if s[4] > floor and .5 < s[2] / s[3] < 1.9], key=lambda x: -x[0][4])[:2]
        eyes.sort(key=lambda x: x[1][0])
        if len(eyes) != 2:
            positions.append([float('nan')] * 4); continue
        a, c2 = eyes[0][1] * k, eyes[1][1] * k
        delta = c2 - a
        angle = float(np.arctan2(delta[1], delta[0])); scale = float(np.linalg.norm(delta) / 70)
        if not (.3 < scale * 70 / fb['w'] < 1.2) or abs(angle) > .6:
            positions.append([float('nan')] * 4); continue
        rot = np.array([[np.cos(angle), -np.sin(angle)], [np.sin(angle), np.cos(angle)]])
        mouth = (a + c2) / 2 + rot @ ANCHOR * scale
        positions.append([*mouth, angle, scale])
    positions = np.array(positions)
    missing = np.isnan(positions[:, 0])
    frames = len(positions)
    if frames != shot['frames']: raise SystemExit(f'{shot["id"]}: decoded {frames} frames, the index says {shot["frames"]}')
    if missing.sum() > frames * .35: raise SystemExit(f'{shot["id"]}: eyes found on only {frames - missing.sum()} of {frames} frames')
    for col in range(4):
        positions[:, col] = np.interp(np.arange(frames), np.flatnonzero(~missing), positions[~missing, col])
    smooth = savgol_filter(positions, 9, 2, axis=0)
    return {'fps': 24, 'frames': np.round(smooth, 4).tolist()}, int(missing.sum())

out = {}
for s in SHOTS:
    if 'Synergy' not in (s.get('characters') or []) or len(s['characters']) != 1: continue
    if s['id'].rsplit('-', 1)[0] in SKIP or s.get('status') == 'E': continue
    if (s.get('faceBox') or {}).get('method') != 'led-eyes+glass': continue
    t, miss = track(s)
    out[s['id']] = {'robot': 'synergy', **t}
    f = t['frames']
    print(f"{s['id']}: {len(f)} frames, eyes lost on {miss} (interpolated), mouth at {f[0][0]:.0f},{f[0][1]:.0f} angle {np.degrees(f[0][2]):.1f} deg scale {f[0][3]:.3f}")
(ROOT / 'src/videostudio/media/robot-tracks.json').write_text(json.dumps(out, separators=(',', ':')) + '\n')
print('wrote', len(out), 'tracks')
