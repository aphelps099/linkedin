# Render "Offline" on an Apple Silicon Mac

For a Claude Code session (or a person) working in a local clone of this repo
on the branch `claude/clever-maxwell-psvch4`. Run everything from
`scripts/synergy-film/`. Cycles uses the Metal GPU automatically
(`lib/common.py` prints `CYCLES DEVICE METAL: ...`).

## 1. Get the latest code

```sh
git pull origin claude/clever-maxwell-psvch4
cd scripts/synergy-film
```

## 2. Install Blender 4.5 LTS (Apple Silicon)

```sh
curl -L -o /tmp/blender.dmg https://download.blender.org/release/Blender4.5/blender-4.5.15-macos-arm64.dmg
hdiutil attach /tmp/blender.dmg -nobrowse -mountpoint /tmp/blender_dmg
mkdir -p ~/Applications && cp -R /tmp/blender_dmg/Blender.app ~/Applications/
hdiutil detach /tmp/blender_dmg
export BLENDER=~/Applications/Blender.app/Contents/MacOS/Blender
$BLENDER --version
```

## 3. Python packages and ffmpeg

```sh
python3 -m pip install --user numpy scipy soundfile pyloudnorm numba h5py
brew install ffmpeg        # if Homebrew is not installed: https://brew.sh
```

## 4. Sound library (about 2.5 GB, licensed recordings)

```sh
python3 tools/fetch_audio.py
```

## 5. Check the GPU on one frame

```sh
$BLENDER -b --factory-startup -P shots/s03_the_drop.py -- --quality final --only 300 --out out/check
```

The log must show `CYCLES DEVICE METAL`. Note the render time for that
frame: final quality is 1600x900 at 32 samples.

## 6. Render the film

```sh
BLENDER=$BLENDER python3 tools/render_all.py --quality final
```

- The queue resumes and skips frames that already exist.
- To re-render one shot after its script changes, delete its folder first, e.g. `rm -rf out/final/s07`.
- Progress and per-frame times go to `out/final/render_log.jsonl`.
- For full 1920x1080 at 48 samples, use `--quality hero` instead (slower).

## 7. Mix the soundtrack and cut the film

```sh
python3 audio/mix.py audio/cues.json --out out/audio/mix.wav
python3 tools/assemble.py --audio out/audio/mix.wav --out out/Synergy-Offline.mp4
```

`assemble.py` takes the best tier available for each frame. Any frame not yet
rendered comes out black.

## Notes

- The shot scripts are still being refined in the cloud session. Pull again before re-rendering a shot.
- Every frame is deterministic: the same script renders the same frame on any machine.
- `out/` is git-ignored. Do not commit renders or audio.
