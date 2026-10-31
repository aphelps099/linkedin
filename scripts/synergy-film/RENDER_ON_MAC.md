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

## 2. Install Blender 4.5 LTS (Apple Silicon), next to any newer Blender

The film is written against the 4.5 API: Blender 5.x changed the compositor,
geometry nodes and the animation system, and every script exits with a clear
message on any version other than 4.5. Keep your newer Blender. Install 4.5
under its own name and point `BLENDER` at it:

```sh
curl -L -o /tmp/blender45.dmg https://download.blender.org/release/Blender4.5/blender-4.5.15-macos-arm64.dmg
hdiutil attach /tmp/blender45.dmg -nobrowse -mountpoint /tmp/blender45
mkdir -p ~/Applications && cp -R /tmp/blender45/Blender.app ~/Applications/Blender-4.5.app
hdiutil detach /tmp/blender45
export BLENDER=~/Applications/Blender-4.5.app/Contents/MacOS/Blender
$BLENDER --version          # must say 4.5.15
```

`curl` downloads are not quarantined, so Gatekeeper leaves this copy alone.
Set `BLENDER` again in any new terminal, or add the export line to `~/.zshrc`.

## 3. Python packages and ffmpeg

```sh
python3 -m pip install --user numpy scipy soundfile pyloudnorm numba h5py certifi
brew install ffmpeg
```

No Homebrew? Install native Apple Silicon builds of ffmpeg and ffprobe from
Terminal. `curl` downloads are not quarantined, so Gatekeeper lets them run:

```sh
mkdir -p ~/bin && cd ~/bin
for t in ffmpeg ffprobe; do
  curl -L -o $t.zip https://ffmpeg.martin-riedl.de/redirect/latest/macos/arm64/snapshot/$t.zip
  unzip -o $t.zip && rm $t.zip && chmod +x $t
done
export PATH="$HOME/bin:$PATH"
file ~/bin/ffmpeg            # must say: Mach-O 64-bit executable arm64
ffmpeg -version | head -1
```

Do not use an Intel (x86_64) ffmpeg downloaded in a browser. macOS kills it,
and `audio/mix.py` and `tools/assemble.py` then hang. Make sure no such copy
comes first on your `PATH` (e.g. remove `~/Downloads` from it). The mix needs
no rubberband: every pitch change in `audio/cues.json` is tape-style
resampling.

## 4. Sound library (about 2.5 GB, licensed recordings)

```sh
python3 tools/fetch_audio.py
```

The fetcher uses `certifi`'s certificate bundle, which fixes the
`CERTIFICATE_VERIFY_FAILED` errors from python.org builds of Python on macOS.
If they persist, run `/Applications/Python\ 3.*/Install\ Certificates.command`
once.

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
