"""Extract reusable mouth/eye poses from the two approved Runway webcam MP4s.

Usage: python scripts/build-face-atlases.py /path/to/source-directory
Source filenames: drums.mp4 and keys.mp4 (original 10-second renders).
Task IDs and generation briefs: src/meeting-studio/webcam-briefs.json.
Only ffmpeg is required. Assets are raw video-frame extractions, not new faces.
"""
from pathlib import Path
import subprocess
import sys
import tempfile

source = Path(sys.argv[1])
target = Path(__file__).resolve().parents[1] / 'public/studio/meeting'
poses = {'drums': [4, .5, 2.25, 1.5, 6.425], 'keys': [5.25, 5.5, 6.0, 6.25, 4.26]}
with tempfile.TemporaryDirectory() as temp:
    for name, times in poses.items():
        frames = []
        for i, seconds in enumerate(times):
            frame = str(Path(temp) / f'{name}-{i}.png')
            subprocess.run(['ffmpeg', '-y', '-v', 'error', '-ss', str(seconds), '-i', str(source / f'{name}.mp4'), '-vf', 'scale=960:540', '-frames:v', '1', frame], check=True)
            frames.append(frame)
        command = ['ffmpeg', '-y', '-v', 'error']
        for frame in frames:
            command += ['-i', frame]
        subprocess.run(command + ['-filter_complex', 'hstack=inputs=5', '-frames:v', '1', '-quality', '90', str(target / f'{name}-faces.webp')], check=True)
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-i', frames[0], '-quality', '90', str(target / f'{name}-still.webp')], check=True)
