"""Replace ONLY Synergy's camera in the archived 90-second Circle Back film.

Reuses the explicitly approved Synergy v2 plate and its tracked face geometry.
All other camera pixels remain unchanged before delivery encoding. Original
AAC packets are copied, not regenerated. No Runway generation is involved.
"""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.io import wavfile

ROOT = Path(__file__).resolve().parents[1]
FPS = 24
TILE = (436, 20, 410, 318)
CROP = (184, 0, 884, 684)


def run(*args):
    return subprocess.run(args, check=True, capture_output=True)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('destination', type=Path)
    args = parser.parse_args()
    args.destination.parent.mkdir(parents=True, exist_ok=True)
    review = args.destination.parent / 'review'
    review.mkdir(exist_ok=True)
    plate = ROOT / 'public/studio/season/clips/synergy-camera-v2-listening.mp4'
    tracks = json.loads((ROOT / 'src/meeting-room/robot-tracking.json').read_text())['synergy']['frames']
    # The approved source already has a matched forward/reverse neutral loop.
    cap = cv2.VideoCapture(str(plate))
    plates = []
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        x, y, w, h = CROP
        plates.append(cv2.resize(frame[y:y+h, x:x+w], TILE[2:], interpolation=cv2.INTER_AREA))
    cap.release()
    assert len(plates) == len(tracks) == 408

    band = review / 'speech-band.wav'
    run('ffmpeg', '-v', 'error', '-y', '-i', str(args.source), '-vn', '-ac', '1', '-ar', '24000',
        '-af', 'highpass=f=250,lowpass=f=3200', str(band))
    sr, samples = wavfile.read(band)
    samples = samples.astype(np.float32) / 32768
    levels = np.array([np.sqrt(np.mean(samples[i*1000:(i+1)*1000] ** 2)) for i in range(2160)])
    levels = np.convolve(levels, [.2, .6, .2], mode='same')
    floor, ceiling = np.percentile(levels, [20, 95])
    levels = np.clip((levels-floor) / max(ceiling-floor, .001), 0, 1)

    # Match the existing small translucent camera name tab.
    label = Image.new('RGBA', (108, 34))
    d = ImageDraw.Draw(label)
    d.rounded_rectangle((0, 0, 107, 33), radius=4, fill=(10, 12, 14, 150))
    d.rounded_rectangle((13, 8, 17, 17), radius=2, fill=(255, 255, 255, 245))
    d.arc((10, 11, 20, 22), 0, 180, fill='white', width=1)
    d.line((15, 22, 15, 25), fill='white', width=1)
    d.line((12, 25, 18, 25), fill='white', width=1)
    font = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 14)
    d.text((31, 7), 'Synergy', font=font, fill='white')
    label = np.asarray(label)
    label_rgb = label[:, :, :3][:, :, ::-1]
    label_alpha = label[:, :, 3:4] / 255

    silent = review / 'corrected-picture.mp4'
    encoder = subprocess.Popen([
        'ffmpeg', '-v', 'error', '-xerror', '-y', '-f', 'rawvideo', '-pix_fmt', 'bgr24',
        '-s', '1280x720', '-r', str(FPS), '-i', '-', '-an', '-c:v', 'libx264',
        '-threads', '2', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p',
        '-movflags', '+faststart', str(silent)
    ], stdin=subprocess.PIPE)
    cap = cv2.VideoCapture(str(args.source))
    speaking, outside_checks = [], 0
    sample_times = {0, 4, 6, 8, 14, 24, 40, 52, 65, 67, 70, 76, 80, 84, 88}
    for i in range(2160):
        ok, original = cap.read()
        if not ok:
            raise RuntimeError(f'Missing original frame {i}')
        frame = original.copy()
        # Read original active-speaker outline; never guess who owns a line.
        rim = original[12:20, 440:840].astype(float)
        active = np.mean((rim[:, :, 1] > rim[:, :, 0]*1.3) &
                         (rim[:, :, 1] > rim[:, :, 2]*1.2) & (rim[:, :, 1] > 100)) > .2
        speaking.append(bool(active))
        n = i % len(plates)
        tile = plates[n].copy()
        x, y, angle, scale = tracks[n]
        sx, sy = TILE[2] / CROP[2], TILE[3] / CROP[3]
        center = np.array([(x-CROP[0])*sx, (y-CROP[1])*sy])
        rot = np.array([[np.cos(angle), -np.sin(angle)], [np.sin(angle), np.cos(angle)]])
        light = np.zeros_like(tile, dtype=np.float32)
        phase = ((i/FPS)*15) % 22
        level = .36 + .64 * levels[i] if active else 0
        for led in range(22):
            distance = (phase-led+22) % 22
            strength = max(.15, (1-distance/8)*level) if active else .065
            # Fixed eight-pixel native height. Only brightness travels sideways.
            quad = np.array([[-46+led*4.3, -4], [-42.8+led*4.3, -4],
                             [-42.8+led*4.3, 4], [-46+led*4.3, 4]])
            quad = (quad @ rot.T * scale) * [sx, sy] + center
            cv2.fillConvexPoly(light, np.rint(quad*16).astype(np.int32),
                               (112*strength, 255*strength, 74*strength), cv2.LINE_AA, shift=4)
        tile = np.clip(tile.astype(np.float32) + light + cv2.GaussianBlur(light, (0, 0), .65)*.15, 0, 255).astype(np.uint8)
        label_y = 283
        region = tile[label_y:label_y+34, 0:108]
        tile[label_y:label_y+34, 0:108] = (region*(1-label_alpha) + label_rgb*label_alpha).astype(np.uint8)
        tx, ty, tw, th = TILE
        frame[ty:ty+th, tx:tx+tw] = tile
        # Exact pixel preservation outside Synergy, prior to compression.
        if i % 24 == 0:
            test = frame.copy()
            test[ty:ty+th, tx:tx+tw] = original[ty:ty+th, tx:tx+tw]
            assert np.array_equal(test, original)
            outside_checks += 1
        if i % 24 == 0 and i//24 in sample_times:
            cv2.imwrite(str(review / f'frame-{i//24:02}.jpg'), frame)
        encoder.stdin.write(frame.tobytes())
        if i % 480 == 0:
            print(f'Rendered {i/FPS:.0f}/90 seconds', flush=True)
    encoder.stdin.close()
    if encoder.wait():
        raise RuntimeError('Picture encode failed')
    cap.release()
    run('ffmpeg', '-v', 'error', '-xerror', '-y', '-i', str(silent), '-i', str(args.source),
        '-map', '0:v:0', '-map', '1:a:0', '-c', 'copy', '-movflags', '+faststart', str(args.destination))
    def audio_hash(path):
        return run('ffmpeg', '-v', 'error', '-i', str(path), '-map', '0:a:0',
                   '-c', 'copy', '-f', 'hash', '-hash', 'sha256', '-').stdout.decode().strip()
    assert audio_hash(args.source) == audio_hash(args.destination), 'Audio must be packet-identical'
    info = json.loads(run('ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(args.destination)).stdout)
    assert int(info['streams'][0]['nb_frames']) == 2160
    assert float(info['format']['duration']) == 90
    run('ffmpeg', '-v', 'error', '-xerror', '-i', str(args.destination), '-f', 'null', '-')
    intervals, start = [], None
    for i, active in enumerate(speaking+[False]):
        if active and start is None:
            start = i
        if not active and start is not None:
            intervals.append([start/FPS, i/FPS]); start = None
    report = {
        'source': str(args.source), 'approvedPlate': str(plate), 'output': str(args.destination),
        'duration': 90, 'resolution': [1280, 720], 'fps': FPS, 'frames': 2160,
        'originalAudioPacketHash': audio_hash(args.destination), 'audioUnchanged': True,
        'outsideTileExactChecks': outside_checks, 'synergyTile': TILE, 'speakingIntervals': intervals,
        'mouth': 'Tracked fixed-height row, scrolling left to right, speaker-gated mixed-audio brightness.',
        'scope': 'Only Synergy camera replaced; all other performances, outline timing, script, voices and music retained.',
        'runwayCredits': 0, 'sha256': hashlib.sha256(args.destination.read_bytes()).hexdigest(),
        'bytes': args.destination.stat().st_size,
    }
    (args.destination.parent / 'edit-proof.json').write_text(json.dumps(report, indent=2)+'\n')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
