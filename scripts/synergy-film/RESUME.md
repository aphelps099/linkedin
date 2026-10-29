# Offline · a Synergy film: paused, resume here

A 60-second, text-free, fully 3D film about Synergy, built from nothing in
Blender 4.5 Python and rendered in Cycles. Paused on 29 Oct 2026 to move to a
faster machine; the build machine had 4 CPU cores and no GPU.

**The story.** Synergy hosts every meeting. He praises each problem and posts it
through the sip slot of the coffee he never drinks. Inside the cup is
*Offline*, a vast world where everything nobody solved has turned into
landscape. When the same padlock comes back again, he unplugs the meeting,
takes his first sip, and the world tilts. His meeting room was inside the cup
all along.

Full shot list, frame-accurate on a 90 BPM grid: [`TREATMENT.md`](TREATMENT.md).

## Status

| Part | State | Where |
|---|---|---|
| Research: canon, lore, word history | Done | `docs/research/` |
| Treatment: 14 shots, 3 environments, sync points | Done | `TREATMENT.md`, `docs/research/treatment.json` |
| Shared render toolkit | Done; picks a GPU automatically | `lib/common.py` |
| LED face (canon 22×16 matrix, 2×3 eyes, 22-LED mouth row) | Done | `lib/face.py` |
| Crowd point caches (flock, paper falls, fireflies) | Done | `lib/cache.py` |
| Synergy model + rig | Round 0 built; critique found fixes | `lib/synergy.py`, `lib/materials.py`, `tools/turnaround.py` |
| Long Room + all props | Round 0 built, not yet critiqued | `lib/env_room.py`, `lib/props.py`, `tools/preview_room.py` |
| Offline (world inside the cup) | Round 0 built, not yet critiqued | `lib/env_offline.py`, `tools/preview_offline.py` |
| Score beat map + music edit | Done, sample-accurate | `audio/music_edit.json`, `audio/beatmap/` |
| Sound library (337 licensed recordings) | Done, download with `tools/fetch_audio.py` | `audio/library.json` |
| Mixing engine (cue sheet to 48 kHz WAV, -14 LUFS) | Built; needs a final test run | `audio/mix.py`, `audio/cues_test.json` |
| Shot scripts `shots/sNN_*.py` | Not started | `shots/shots.json` has the table |
| Animatic, final renders, sound design, delivery | Not started | `tools/render_all.py`, `tools/assemble.py` |

All three modules were smoke-tested at the pause: robot (206 parts), room and
cup world each build without errors. Round-0 contact sheets are in
`docs/progress/`.

## Set up the new machine

1. **Blender 4.5 LTS.** Download from https://download.blender.org/release/Blender4.5/
   and put `blender` on your PATH, or set `BLENDER=/path/to/blender`. On a Mac:
   `/Applications/Blender.app/Contents/MacOS/Blender`.
2. **GPU.** `lib/common.py` picks the first available Cycles backend (OptiX, CUDA,
   Metal, HIP, oneAPI) and prints `CYCLES DEVICE ...` on startup. To force one,
   set `SYNERGY_DEVICE=METAL` (or `CPU`).
3. **Python 3.10+** with `pip install numpy scipy soundfile pyloudnorm numba librosa`.
4. **ffmpeg**, ideally with `rubberband`.
5. **Sound library:** `python3 tools/fetch_audio.py` (~2.5 GB into `out/audio/raw/`).
6. `out/` is git-ignored. Renders, caches and audio all live there.

Quick checks, run from `scripts/synergy-film/`:

```sh
blender -b --factory-startup -P tools/turnaround.py -- --out out/check/model
blender -b --factory-startup -P tools/preview_room.py -- --quality proof --out out/check/room
blender -b --factory-startup -P tools/preview_offline.py -- --quality proof --out out/check/offline
python3 audio/mix.py audio/cues_test.json --out out/audio/test_mix.wav
```

## What to fix next (round-0 review)

**Synergy** (critic notes: `docs/research/critiques-round0.json`):
- Too clean and too white. Warm the enamel toward `#E3D2B4`, and add seam grime, rust bleed at rivets and chipped edges. Compare with `docs/refs/video_synergy-v2-source_t3.jpg`.
- Check the stray translucent discs seen near the neck and waist, which are probably steam or vinyl cards.
- The legs read as plain tubes. The canon calls for faceted thighs and shins with grey inserts.
- The rig critique (cup grip, headset detach, piston follow-through) never ran. Run it before animating.

**Long Room:**
- Far too dark in the S03 wide. The terminals must read as nine glowing colour fields, with long streaks on the walnut and the hard skylight slab down the spine.

**Offline:**
- Too hazy and soft overall. The S08 poster wide reads as a terrarium, not a vast world.
- Push crispness: less mist, sharper fibre detail, slower and wider cameras.
- Remove the stray translucent ovals.
- Make the padlocks legible in the arch.
- Profile render cost. On 4 CPUs a 400×225 proof took 15-30 s.

## Remaining plan

1. Finish the critique loops for the robot, room and cup world until a hero close-up holds up.
2. Write the 14 shot scripts (`shots/sNN_<name>.py`, names in `shots/shots.json`). Each builds its environment, places Synergy, keys the performance and face timeline, and calls `common.render(...)`. Lock S01/S02 (slot match cut) and S14 (rise through the skylight) first.
3. Make an animatic: `python3 tools/render_all.py --quality animatic --step 2`, then `python3 tools/assemble.py --tiers animatic --hold --audio <mix> --out out/animatic.mp4`. Review the timing against the beat grid.
4. Sound design: write `audio/cues.json` from the treatment's sound notes and `audio/music_edit.json`, then mix with `audio/mix.py`.
5. Final renders: `python3 tools/render_all.py --quality final`. The queue resumes and skips finished frames. Use `--quality hero` for 1920×1080 at 48 spp if the GPU allows.
6. Deliver: `python3 tools/assemble.py --audio out/audio/mix.wav --out out/Synergy-Offline.mp4`.

**Picking up with Claude Code:** check out this branch and ask it to read
`scripts/synergy-film/RESUME.md` and continue from "Remaining plan". Include
"ultracode" if you want multi-agent workflows again.

## Rules that must survive

- No text anywhere: no letters, numbers or logos, including on the badge, screens and paper. The badge is blank with a small green 2×3 eye glyph.
- The LED mouth is one fixed-height row. Brightness travels left to right only.
- The cup stays at chest height until the sip in S13. There is exactly one head dip in the film (S11). He never walks.
- Sound: only real, licensed recordings, logged in `audio/library.json`. Nothing is synthesized in code.

## Licences

- Score: "Night Sky Hip Hop", Mixkit #970, Mixkit Stock Music Free License.
- SFX: Mixkit (free licence), Sonniss GDC bundles via archive.org (royalty-free EULA), Wikimedia Commons and OpenGameArt items as logged.
- Kevin MacLeod tracks are CC-BY 4.0 and need credit only if used.
- The recordings are not committed, because Mixkit forbids redistributing sounds on their own.
- One user-supplied reference image is not committed; the rest of `docs/refs/` comes from images already in this repo.
