---
name: synergy-scene
description: Create a new Synergy scene or episode, or change an existing one, in the procedural Blender film system under scripts/synergy-film (robot rig, boardroom, world-inside-the-cup, licensed sound library, 90 BPM music grid). Use when asked to make, pitch, edit, re-render or re-score any Synergy film scene.
---

# Make a Synergy scene

Read `scripts/synergy-film/CLAUDE.md` first. It holds the canon, the map
and the craft bar. Work from `scripts/synergy-film/` with `BLENDER` set to
Blender 4.5 (see `RENDER_ON_MAC.md`). Show the user stills at every
checkpoint: they direct, you build.

## 1. Pitch (agree before building)

- Ground ideas in the lore: `docs/research/story-bible.md` and `docs/research/lore-and-word-history.txt`.
  - Synergy hosts every meeting, praises every problem, and takes it offline.
  - Recurring elements: the coffee he never drinks, the printer that never stops, the paper droid, Pat's camera always off.
- Offer three one-line pitches, each with a single strong visual idea, a beginning-middle-turn, and a wordless payoff. Let the user pick or merge.
- Prefer ideas the existing sets and rig can carry: the Long Room, the world inside the cup, the macro inserts. New sets are fine, but budget for them.

## 2. Treatment and shot list

- Create `episodes/<name>/`. Write `TREATMENT.md` the way the root one is written:
  - the logline, then shots that tile the timeline exactly;
  - for each shot: frames, action beat by beat, Synergy's performance with face events, camera (lens, move, focus), light and sound.
- Cut on the music grid: 16 frames per beat, 64 per bar.
- Write `episodes/<name>/shots.json`: `[{"id": "s01", "start": 1, "end": 128, "env": "...", "script": "s01_name.py"}, ...]`, frames 1..N with no gaps.

## 3. Build each shot

- Copy `shots/_template.py` into `episodes/<name>/` (it finds `lib/` from anywhere).
- Build only what the camera sees:
  - `env_room.build(...)` with `preview_camera()` framings and `room.front_bokeh(cam)`;
  - `env_offline.build_offline(state, include=...)`;
  - `synergy.build(timeline=face.FaceTimeline(start, end), location=env_room.SYNERGY_POS)`.
- Key the performance on film frames. Use `rig.apply_preset`, `rig.pose`, `rig.post` and `rig.breathe`. Key in-between poses for big arm moves, then call `rig.bake_pauldrons()`.
- Put new props in `lib/props.py`, or a new module if the shared one shouldn't change. Keep them text-free and hero quality (bevels, wear, real materials).
- Check every shot with proof stills: first frame, each sync point, last frame. Then make a contact sheet of every 8th frame at `--quality animatic`:
  ```sh
  $BLENDER -b --factory-startup -P episodes/<name>/s01_name.py -- --quality proof --only 1,64,128 --out out/check/<name>
  ```
- Critique each shot honestly before showing it: framing vs the treatment, light, materials, performance, canon, continuity with the neighbouring shots, accidental text. Fix, then show the user.

## 4. Render

```sh
BLENDER=$BLENDER python3 tools/render_all.py --quality final --shots-json episodes/<name>/shots.json --out out/episodes/<name>
```

- Use `--quality hero` for 1920x1080 at 48 samples.
- To re-render a changed shot, delete its folder under `out/episodes/<name>/final/` first.

## 5. Sound

- Music:
  - Default to "Night Sky Hip Hop" (Mixkit #970, `audio/library.json`), so the films sound like a series.
  - Use sections the first film didn't: `audio/beatmap/night_sky_beatmap.json` maps every bar, including a brighter layer from bar 18 and a breakdown at bars 68-75.
  - Any other track needs a licence allowing free use. Log it.
- Foley and ambience come only from the licensed library. New downloads go into `audio/library.json` with their licence, and must be real recordings: nothing synthesized.
- Copy the pattern of `audio/build_cues.py` into `episodes/<name>/build_cues.py`, and write `episodes/<name>/cues.json`. Put every hit on its exact frame. Keep the mix dynamic: about -16 LUFS, true peak -1 dBTP.
  ```sh
  python3 episodes/<name>/build_cues.py
  python3 audio/mix.py episodes/<name>/cues.json --out out/episodes/<name>/mix.wav --frames <N>
  ```

## 6. Cut and review

```sh
python3 tools/assemble.py --shots-json episodes/<name>/shots.json --frames out/episodes/<name> \
  --audio out/episodes/<name>/mix.wav --out out/episodes/<name>/<Name>.mp4
ffmpeg -i out/episodes/<name>/<Name>.mp4 -vf "fps=1,scale=480:-1,tile=6x10" -frames:v 1 out/episodes/<name>/contact.jpg
```

Review the contact sheet frame by frame against the treatment and the canon,
then hand the MP4 to the user.

## 7. Commit

- Commit `episodes/<name>/` and any `lib/` changes on the working branch.
- Never commit `out/`.
- If `lib/` changed, re-render a proof frame of the first film's affected shots to confirm nothing broke.
