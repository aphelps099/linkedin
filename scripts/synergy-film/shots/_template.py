"""Template for a shot script. Copy to sNN_<name>.py (see shots.json) and fill in.

    blender -b --factory-startup -P shots/sNN_name.py -- --quality proof --only 300,320
    blender -b --factory-startup -P shots/sNN_name.py -- --quality final

Every shot builds its scene from nothing on the film timeline (global frame
numbers), so any frame renders identically on any machine. Keep the shot's
beats on the 16-frame grid in TREATMENT.md and its sync points exact.
"""

import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
_root = HERE
while not os.path.exists(os.path.join(_root, 'lib', 'common.py')):
    _root = os.path.dirname(_root)   # shots/ or episodes/<name>/ both find scripts/synergy-film/lib
sys.path.insert(0, os.path.join(_root, 'lib'))

import common as C  # noqa: E402
import face as F  # noqa: E402

SHOT = 'sNN'
INFO = next(s for s in json.load(open(os.path.join(HERE, 'shots.json'))) if s['id'] == SHOT)
START, END = INFO['start'], INFO['end']


def build(args):
    C.new_scene(START, END, args.quality, samples=args.samples, threads=args.threads)

    # environment: import env_room as R / env_offline as O and build only what the camera sees
    # room = R.build(state='lit')

    # Synergy: performance keyed on film frames, face from a FaceTimeline
    # import synergy as S
    # tl = F.FaceTimeline(START, END).blink(START + 40)
    # rig = S.build(timeline=tl, location=R.SYNERGY_POS)
    # rig.apply_preset(START, 'idle_cup')

    # camera: lens, move and focus exactly as the treatment specifies
    # cam = C.camera(lens=85, location=(...), target=(...), fstop=2.0, focus=...)

    # house look
    # room.compositor()


if __name__ == '__main__':
    a = C.shot_args()
    build(a)
    C.render(SHOT, a, START, END)
