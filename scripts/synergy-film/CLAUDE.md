# Synergy films: working notes for Claude

Procedural 3D films about Synergy, the deadpan robot host of the LinkedIn Beats
office. Everything is built from code in Blender 4.5 LTS (Python) and rendered
in Cycles. There are no templates, stock 3D assets or generated video. The
first film is "Offline" (`TREATMENT.md`, `shots/`). New scenes and episodes go
in `episodes/<name>/` and reuse the same robot, sets and tools.

Use `/synergy-scene` (`.claude/skills/synergy-scene/SKILL.md`) for the full
new-scene workflow. Setup and rendering: `RENDER_ON_MAC.md`. Editing existing
shots: `EDITING.md`.

## Map

- `lib/common.py`: scene setup, render presets (proof / final 1600x900 / hero 1920x1080), camera, lights, compositor, render CLI. Requires Blender 4.5 and picks the GPU itself.
- `lib/synergy.py` + `lib/materials.py` + `lib/face.py`: the robot. `build()` returns a `Rig` with `pose()`, `apply_preset()` (idle_cup, sip, thumbs_up, reach_L, hands_clasped, seated, post_L), `post()`, `attach_cup()`, `detach_headset()`, `breathe()`, `lean()`. `face.FaceTimeline` drives the LED face: `power_on`, `blink`, `speak`, `sweep`, `wide`, `brows`, `smirk`, `look`, `flash`, `off`.
- `lib/env_room.py` + `lib/props.py`: the Long Room boardroom and every prop. CRTs can `speak`/`flare`/`shutdown`/`power_on`, the printer can `feed`, the droid can `drive`. The coordinates live in `ROOM`, and approved framings in `preview_camera()`.
- `lib/env_offline.py`: the world inside the coffee cup (`build_offline(state, include=...)`).
- `lib/cache.py`: PC2 point caches for crowds (flocks, falling paper, fireflies), with motion blur.
- `shots/_template.py`: starting point for any shot script. `tools/render_all.py`, `tools/assemble.py`: render queue and final cut (both accept `--shots-json`).
- `audio/`: cue-sheet mixer (`mix.py`), cue builder (`build_cues.py`), licensed library index (`library.json`), music beat map (`beatmap/`).
- `docs/research/`: story bible, visual canon (measured from the approved references), lore, critique notes. `docs/refs/`: reference images.

## Canon (never break)

- No text anywhere: no letters, numbers or logos, including on screens, paper, props and reflections. The badge is blank with a small green 2x3 eye glyph.
- The face is a recessed black glass screen. Eyes are 2x3 green LEDs. The mouth is ONE fixed-height row of 22 LEDs whose brightness travels left to right only; it never opens or grows. 3x3 eyes, brows and a smirk pixel are a rare expressive register.
- Look: faceted cream/ivory riveted plates with grey patches, rust and wear, a blue paint chip on the chest, black headset with boom mic, lanyard, white paper cup in his RIGHT hand at chest height.
- Acting: deadpan, mechanical, restrained. Small precise moves, at most one head dip per film, a stiff protocol-droid gait if he walks. The humour is excessive professional seriousness.
- Sound: only real, licensed recordings and licensed music logged in `audio/library.json` (fetch with `tools/fetch_audio.py`). Nothing synthesized in code. Processing (edit, EQ, filter, gain, pitch, convolution with recorded IRs) is fine.

## Craft bar

Pentagram-level restraint: graphic compositions, real materials with
micro-detail, motivated light, every frame a still worth printing. Cut on the
music grid. "Night Sky Hip Hop" (Mixkit #970) is exactly 90 BPM: 16 frames per
beat at 24 fps, a bar every 64 frames. Preview with `--quality proof` on a few
frames before any full render, and look at the stills before moving on.

## Housekeeping

- Run from `scripts/synergy-film/` with `BLENDER` pointing at Blender 4.5.
- `out/` (renders, caches, audio) is git-ignored: never commit it.
- Commit scripts and docs on the working branch.
- Shared libraries affect every shot. After changing `lib/`, re-render a proof frame of each shot that uses it.
