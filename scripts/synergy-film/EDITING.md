# Editing "Offline": how to change a scene

The film is code: every frame is rebuilt from the scripts here, so an edit is
a change to a script followed by a re-render of the frames it affects. Work in
a local Claude Code session on the Mac (fast GPU), on the branch
`claude/clever-maxwell-psvch4`, from `scripts/synergy-film/`. Setup is in
`RENDER_ON_MAC.md`.

## Where things live

| To change | Edit | Re-render |
|---|---|---|
| One scene: camera, timing, action, Synergy's pose or face, lighting | `shots/sNN_*.py` (frame ranges in `shots/shots.json`) | that shot only |
| Synergy himself (shape, materials, rig, LED face) | `lib/synergy.py`, `lib/materials.py`, `lib/face.py` | every shot he appears in |
| The boardroom and its props (CRTs, table, printer, droid, padlock, jack, cup and lid) | `lib/env_room.py`, `lib/props.py` | S02-S05, S07, S09-S11, S13, S14 |
| The world inside the cup | `lib/env_offline.py` | S01, S06, S08, S12, S14 |
| The render look (resolution, samples, colour, glare) | `lib/common.py` | everything |
| Sound | `audio/build_cues.py`, then `audio/cues.json` | mix only |

The story, shot by shot and frame by frame, is in `TREATMENT.md`. The 90 BPM
grid (16 frames per beat) and the sync points in its frame map tie picture to
sound. If an edit moves a sync point, move the matching cue in
`audio/build_cues.py` too.

## Loop

```sh
export BLENDER=~/Applications/Blender-4.5.app/Contents/MacOS/Blender
export PATH="$HOME/bin:$PATH"

# 1. preview a few frames of the shot you changed (seconds each on the M1 Max)
$BLENDER -b --factory-startup -P shots/s07_deferral_machine.py -- --quality proof --only 609,657,705,752 --out out/check

# 2. re-render that shot at final quality
rm -rf out/final/s07
BLENDER=$BLENDER python3 tools/render_all.py --quality final --shots s07

# 3. if sound changed: rebuild the cue sheet and mix
python3 audio/build_cues.py && python3 audio/mix.py audio/cues.json --out out/audio/mix.wav

# 4. re-cut the film
python3 tools/assemble.py --audio out/audio/mix.wav --out out/Synergy-Offline.mp4
```

Commit script changes to the branch. Never commit `out/` (renders, audio):
it is git-ignored.

## Rules that keep it Synergy

- No text anywhere. The badge is blank with a small green 2x3 eye glyph; screens show only colour.
- The LED mouth is one fixed-height row. Brightness travels left to right only. Eyes are 2x3.
- The cup stays at chest height in his right hand until the sip in S13.
- Exactly one head dip in the film (S11). He never walks.
- Sound is real licensed recordings only (`audio/library.json`). Nothing is synthesized.

## Open notes from the last critique round

`docs/research/shot-critiques.json` holds the critics' latest blocker and
major notes for every shot, with scores. S01, S03, S09 and S13 were revised
against them. S02, S04, S06, S10, S11 and S12 were mid-revision when the
cloud session stopped, so some of their notes are applied and some are not.
S05, S07, S08 and S14 have notes that were never applied. Treat them as
suggestions: your own edits come first.

## Starting a new chat

> I'm editing the Synergy film "Offline". Read scripts/synergy-film/EDITING.md
> and RENDER_ON_MAC.md, then help me change: <describe the scenes and edits>.
> Preview with proof frames first, show me, then re-render the shot.
