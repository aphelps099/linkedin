# Printer Song: the printer sings

For the Claude Code session on Aaron's Mac, which renders the final film, and for Aaron.

A 33.5 s vertical music video for Aaron's track "Printer Song": a 3 s loading screen, then the 30.5 s film Aaron saw. The printer is the singer: its face is built from one take, stacked down the 9:16 frame like a totem. Its two status LEDs are the eyes, its paper slot is the mouth, the Peg Board home is its display, and its output tray is the body, in pegs. The mouth sings the song's glides: the page comes out of the slot as the pitch rises and is swallowed back as it falls. The song has no lyrics, so the printer sings in Peg Board type.

The arc: it loads, wakes, overdelivers, multiplies, gives everything, burns out, works nights, breaks. Between its gestures it dreams.

## Where things are

| | |
|---|---|
| The film | `src/videostudio/treatments/printer-mouth.js` (the cut) and `printer-song.js` (the song as a plan: the clock, the glides, the words) |
| The sound | `assets/printer-song/printer-song-film.flac`, made by `scripts/edit-printer-song.py` from Aaron's master (kept out of the repo) and Synergy's word (`assets/printer-song/printer-intro-voice.flac`, made by `scripts/render-printer-intro.mjs`) |
| The render | `scripts/export-videostudio.mjs --track printer-song` (one command, below) |
| The review | `scripts/review-printer-video.py` (numbers), plus the ffmpeg commands below (pictures) |
| The checks | `node scripts/check-videostudio.mjs` section 16, "the printer's film" |

## Two clocks

- **Film frames** are the file's: 804 frames at 24 fps, 33.5 s. The intro is frames 0 to 71.
- **Song frames** are the 30.5 s edit Aaron saw (the draft's frame numbers). Film frame = song frame + 72.
- `printer-mouth.js` is written in song frames; `printer-song.js` LINES, the plan, the program, the review and this sheet use film frames. 72 frames is 24 steps of the song's 16th grid, so the grid runs on through the intro.

## The sound

- **Source:** Aaron's master, 40.12 s, 44.1 kHz 16-bit stereo, -11.3 LUFS.
- **Measured clock:** a 16th of 0.125 s (120 BPM) is the sharpest periodicity in every band. Its phase is weak, and no downbeat can be heard. A step is exactly 3 frames, and the cues sit on the song's gestures, not on bar lines.
- **The intro (film 0 to 3.000 s):** Aaron's own opening, played backwards and slowed. Source 0 to 2.25 s runs in reverse through a varispeed that rises from half speed (an octave down) to normal speed, and its level rises from -30 dB to 0 dB. Its last sample is the source's first sample, at its own pitch and level, so the song plays forwards from that same sample: a palindrome join, no fade, no click.
  - **Why not the literal version** (a piece of the song, g4, reversed at half speed: Aaron's first idea, kept as `--variant tape`): measured on the edit, it steps +6.5 dB into the film's first frame (100 ms either side), jumps an octave in timbre there (spectral centroid 0.59 to 1.11 kHz), and buries the word 3 dB under the bed in its own band (600-3000 Hz). The swell steps +1.0 dB, keeps its timbre across the join (1.12 to 1.11 kHz) and sits the word 11 dB over the bed: it resolves on the first frame, where the face appears, as if the song were rewinding into place.
- **Synergy's "Loading.":** the project's robot voice, end to end: eSpeak NG in his approved voice (the voice route's: en-us, pitch 35, amplitude 140) at 154 wpm, through his own vocoder and voice chain (`src/allhands/vocoder.js`, the engine's saw choir as the carrier, his high-pass, compressor and the dotted-eighth echo), rendered offline in headless Chromium. The carrier falls a fourth onto the track's tonic (A3 to D3). Its onset is at film 0.500 s (frame 12). Whisper small.en hears "Loading" in the finished mix.
- **The song (film 3.000 to 33.500 s):** source 0.000 to 14.250, then 24.000 to 39.520, joined by a 30 ms equal-power crossfade.
  - 9.750 s is the track's own repeat (78 sixteenths), so the grid runs on through the join.
  - The first cut joined at 14.500 / 24.250: a +6 dB step in 100 ms, the largest in the film. This join measures +0.7 dB. The cue frames after it did not move.
  - Nothing fades at the end: Aaron's hard stop (film 32.750) is the ending. Silence pads the file to 33.500 s.
- **Identity:** outside the intro and the crossfade, every sample is the source's own.
- **Song time:** equals source time before 14.25 s, and source minus 9.75 s after.

## The cue sheet (film frames at 24 fps; song frame in brackets)

The face is laid out as `stack3`: the eyes on top (the LED row, in big pixel blocks that swell with the song's voice band), the mouth in the middle (the paper slot, with the call's name bar "Printer · Deliverables"), the board home under it, the tray at the bottom as peg video (the take's clean 75-frame loop at half speed: it steps at 12 fps, the printer's own stepping, kept on purpose).

| f | Picture | Board | Sound |
|---|---|---|---|
| 0 to 11 | Black; the board powers on. An eye of stepped rings opens round an empty bar (Aaron's loader in the board's own pegs: blocks of 2 × 2 pegs, white stripes, one in six amber). | The loading bar's frame | The reversed swell, near silence |
| 12 | The rings flow in toward the bar on every sixteenth, faster as the sound swells. | **LOADING.** (white); the bar starts to load | Synergy: "Loading." |
| 12 to 63 | The bar loads with the intro's own sound. | | The swell rises |
| 55 to 63 | The eye shuts onto the full bar. | Loaded on f63 | |
| 64 to 71 | The screen folds into the printer's display. | | |
| 72 (0) | The face appears around it. Eyes shut, mouth closed. | One blue lissajous curve | The song's first sample |
| 81 to 118 (9 to 46) | It hums: the page's edge twitches on each vertex. The speaking border lights. | | g1, g2 |
| 119 (47) | Eyes open. | **READY.** | Onset 1.989 s |
| 130 to 158 | It dozes (the first dream). | | |
| 165 (93) | g3: the page nibbles out (12 frames of stroke: its edge, never the whole page). | | g3 |
| 192 (120) | Blink. | | |
| 222 to 241 (150 to 169) | g4's full stroke: page out, swallowed, spat out with a downward blur. The face lunges 6 % at the words. | **THRILLED** f222, **TO** f230, **PRINT.** f233 (blue) | g4 |
| 269 (197) | g5's nibble. | | g5 |
| 318 (246) | Blink. | | Onset |
| 332 to 346 (260 to 274) | The eyes become a second mouth, 3 frames behind the first (its slot higher: the page's edge, not a second logo). | **PAGE** f334, **2** f337, **OF** f343, **1.** f345 (white) | g6 |
| 395 (323) | The whole printer at last, boxed; round the box the black is a tunnel of stepped rings rushing out on every sixteenth. No chrome. | **FULL** (blue) | g7, the big one |
| 403 (331) | **BLEED.**: the picture breaks out to all four edges, tiled 2 × 2 (copies, never reflections). | **BLEED.** | g7's peak |
| 404 to 418 | The copies come apart in motion tiles dealt on every sixteenth. | | |
| 409 (337) | Tiled 3 × 3; from here it floods into the tray's own pegs (full by f418). | | g7's last rise |
| 420 (348) | Back to the face. The mouth holds its note open and leans in (zoom 1.25 by f476). | | The cut meets the onset at song 14.5 s |
| 476 (404) | One eye goes out; the whole face drains (the eyes too) and its plates slip out of register (8 px by f486). | **TONER** f476, **LOW.** f482 (white) | The top end drains |
| 493 to 499 (421 to 427) | The page is swallowed whole. | | The breath |
| 500 (428) | Night: the whole face goes blue, the eyes shut, the mic mutes. It sleeps in rings. | **OUT OF / OFFICE.** f500, f503, f506 (white, two lines). The display dreams in stepped blue rings. | B lands |
| 549 (477) | Eyes open; the face lunges. | A signal strike through OUT OF OFFICE. | b1 |
| 566 (494) | Mic back on. It chews on the onsets. | **STILL / PRINTING.** f566, f569 (blue) | The 2.69 kHz line |
| 621 to 774 (549 to 702) | The long night: it dreams deepest. The board's rings run on into the face, up through the tray and the mouth (to .75 by f778); the eyes ring; the mouth's picture comes apart in tiles. Blinks on f688 and f713. | From f675: its old **THRILLED TO PRINT.** burnt into the display, a ghost | The 1.80 kHz line |
| 778 to 782 (706 to 710) | Swallowed. | | The last glide |
| 784 (712) | Spat out with a blur. | | |
| 786 (714) | **Frozen.** The board lets go: no wash, no rings. A grey, real printer, the page's edge in the slot, the eyes one long amber bar, the mic muted, the tray frozen. | **PAPER JAM.** (signal) to the end | The hard stop, then silence |
| 804 | End. | | |

## The dream (Aaron's note: after loading, the printer is dreaming)

Between its gestures it drifts off over 8 frames and wakes over 8, always before the next glide opens the mouth (song frames, `DREAMS` in `printer-mouth.js`): 58-86, 114-145, 172-192, 211-255, 281-318 by day, 438-474 asleep under OUT OF OFFICE., and 549-702, the long night, the deepest. While it dreams:

- the face floats (a few px of drift and half a degree of sway, three periods so it never loops); the board holds still, so the words never move;
- its lids droop over the LEDs (half-shut eyes);
- the colour drifts (a light duotone wash by day, the night's blue deepening toward violet);
- the tray's pages smear, the mouth's page trails at night;
- little stars turn in pegs over the tiles (`sparkle`), never on the board, never green, never over the words;
- the square edges below.

## Square edges (Aaron's note: pixelated, square-edged psychedelics like look-serious.com's loader)

His studio's loader is hard-edged, big-pixel, staircase-stepped concentric rings in flat colour, opening like an eye. The film takes the approach, in the house palette (white, blue, deep, signal on socket black; never green):

- **`contour`** (a new effect): stepped contour bands of a squarish distance field, measured at the centre of each big block, so every edge is a block's edge; flat colours, no anti-aliasing. A stripe is always a whole number of blocks wide, so the bands never pulse in width as they move.
- **`pixelTiles`** (a new effect): motion tiles. The picture is cut into 96 px tiles; on each tick some are dealt again: each drops to blocks of 24, 12 or 6 px, rolls its picture a block inside itself and re-quantises its light to 4 levels (its hue kept). Size and place, not light.
- **`loading` and `contour` looks** on the Peg Board: the same rings, in blocks of pegs.

Where they are:

| Where | What |
|---|---|
| The loading screen | An eye of stepped rings round LOADING. and the bar: it opens, flows in on every sixteenth faster as the sound swells, and shuts onto the full bar. One stripe in six is amber: the printer's eyes before it has a face. |
| The eyes, while it dreams | Stepped rings round each LED, the LED the pupil, growing out of the eyes as it drifts off and back as it wakes; white with an amber stripe by day, blue with a white one by night. |
| The mouth, while it dreams | Motion tiles, dealt on every eighth. Never while it sings. |
| The tray, while it dreams by day | The display's rings leak down into the body. |
| FULL | The letterbox round the boxed printer is a tunnel of rings rushing out on every sixteenth. |
| BLEED. | The copies come apart in motion tiles on every sixteenth before the pegs take them. |
| The night | The display dreams in blue rings (blocks of 3 × 3 pegs, 21 px); from song f559 the same field, block and phase run on from the display into the face, up through the tray and the mouth, and let go on the jam. |

Every ring step and every tile deal lands on the song's grid (eighths while it dreams, sixteenths in the intro and the bleed); check-videostudio section 16 proves it.

## The printer's words

LOADING. / READY. / THRILLED TO PRINT. / PAGE 2 OF 1. / FULL BLEED. / TONER LOW. / OUT OF OFFICE. (struck) / STILL PRINTING. / PAPER JAM.

- **Colour:** status words are white, its enthusiasm is blue, and PAPER JAM. is the one signal word (with the house strike).
- **Signal-coloured light:** the amber LEDs, the eyes' rings by day, and one stripe in six of the loading eye (the LEDs before there is a face).
- **Placement:** each word lights on the frame that holds its gesture. Section 16 of `check-videostudio` proves every one.

## The rules broken on purpose

**Reversed pages.** The shot index says printer pages never reverse (R0: "Pages never reverse; freeze instead"). Here they do, in this film only (the brief: Aaron asked for it super weird). The paper slot is a mouth, and a mouth that cannot close cannot sing: the page is swallowed back into the slot as the pitch falls.
- Every mouth clip carries an override with rule G7 and that note, so the lint shows it as a waived warning, not an error.
- The scenes start on the song's glides, not on bar lines. G4 is waived with a note, because the track has no audible downbeat.

Nothing else is waived.

**The "in" mark, a deliberate exception for Aaron to confirm.** The printer's pages carry the LinkedIn "in" mark (it is the project's own approved footage: the printer's output). It is kept quiet: the nibbles never show the whole logo for more than 12 frames, the second mouth shows the page's edge, the tray's pegs are 3 levels (the logo dissolves), and the bleed's 2 × 2 and 3 × 3 copies come apart in tiles and pegs within a second. It is still recognisable at g4, g7 and in the bleed. If Aaron wants it gone, crop the mouth higher or lower the tray's levels further; both are data in `printer-mouth.js`.

## The one command

Start the session as usual:

```bash
cd ~/Documents/GitHub/linkedin-allhands && export PATH="/opt/homebrew/bin:$PATH" && source .venv/bin/activate
git pull
```

Then render:

```bash
node scripts/export-videostudio.mjs --track printer-song --format 9:16 --master --gpu --aac 320k --out ~/Desktop --name printer-song-9x16
```

It writes two files:
- `~/Desktop/printer-song-9x16.mp4`
- `~/Desktop/printer-song-9x16.json`, the sidecar: hashes, lint, timings, the governor's record, and the EDL that cut the film.

The file:
- **Video:** 1080×1920, 24 fps CFR, H.264 High yuv420p at 24 Mbps (`--master`: the peg grids, the rings and the moiré need it).
- **Audio:** AAC-LC 320k, 48 kHz stereo, muxed by ffmpeg from the FLAC (the intro, Synergy's word and the song in one file).
- **Container:** moov first (faststart). 804 frames, 33.500 s.

The flash governor is on by default. Never add `--no-governor`: it is a photosensitivity safety rule.

**The first line of output names the renderer.**
- With `--gpu`, it should name the Mac's GPU (for example "ANGLE (Apple, ANGLE Metal Renderer: Apple M...)").
- If it says SwiftShader, the GPU was not used: the render still works but on the CPU. In the cloud (4 cores, no GPU) the 540×960 render ran at about 5.5 s a frame and 1080×1920 with `--master` at about 35 s a frame (7 to 8 hours), so the final belongs on the Mac's GPU.

**If `--gpu` fails** with "WebGL2 is not available", try these in order:
1. Replace `--gpu` with `--headed`. This opens a real Chromium window, which the Mac's GPU always serves. Leave it alone until it finishes.
2. Drop both flags. SwiftShader is slow but certain.

After a `--gpu` run, check the sidecar's `video.bytes`: about 100 MB is right (24 Mbps × 33.5 s). Far less means the hardware encoder undershot: render again without `--gpu`.

**Before the first run, check the proxies.** The proxy for the take should be on disk:

```bash
ls public/videostudio/proxies | grep printer-outward-feed-19442475
```

If nothing is listed, build it (it fetches the master from the bucket once):

```bash
node scripts/build-videostudio-proxies.mjs --only printer-outward-feed-19442475
```

**To rebuild the sound** (only if the FLAC is missing or Aaron changes the edit):

```bash
node scripts/render-printer-intro.mjs                               # Synergy's "Loading." (needs espeak-ng)
python3 scripts/edit-printer-song.py ~/Desktop/printer-song.wav     # Aaron's master: the intro, the edit, the word
```

## What the cloud proved (Nov 6)

The whole film at 540×960 (`--scale .5`), rendered in the cloud on 4 CPU cores with SwiftShader (no GPU), at about 5.5 s a frame:
- 804 frames, 33.500 s, H.264 High yuv420p + AAC LC 48 kHz, both streams starting at 0.
- Flashes: whole frame 1.0 a second at worst; quadrants and rows 1.5 at worst (the limit is 3).
- No black frames, no decode errors, no green in the board.
- Sound: offset 0.00 ms against its source; -11.4 LUFS integrated, true peak -0.4 dBTP.
- Cue sync: 62 of 65 cue frames land on their frame. Three land early: BLEED. edge to edge (cue f403, picture f402), the cut back to the face (f420, picture f418) and STILL (f566, picture f564). Fix these first (below).

The 1080×1920 final was not rendered in the cloud: with `--master` it ran at about 35 s a frame there (7 to 8 hours). It belongs on the Mac's GPU.

## Open before the final (do these first, then render)

1. **The three early cues.** BLEED. (f403), the cut back to the face (f420) and STILL (f566) change the picture 1 to 2 frames early in the render. Find what moves first (a dream effect stepping before the cut, or a key one step early), fix it in `printer-mouth.js`, and render each span at `--scale .5` until `review-printer-video.py` passes.
2. **Sharpness at 1080.** A critic found that `--master` may only raise the encode to 24 Mbps while the footage still comes from the 540-line proxies (`src/videostudio/render/export.js` media `proxy`), which would make the mouth a 2.8× upscale. Render a 1080 test span first (`--span 140-175 --scale 1 --master --gpu --aac 320k`), look at the mouth at 100%, and switch that clip to the 1080p master if it is soft.
3. **The "in" mark.** It is the printer's own output in the project's footage and stays, but never tiled or doubled at full size: check PAGE 2 OF 1. (the second mouth), the BLEED. copies and the tray, and keep one logo at a time.

## Review it before Aaron sees it

Run all of this on the Mac's own render.

### Numbers first

```bash
python3 scripts/review-printer-video.py ~/Desktop/printer-song-9x16.mp4 --frames ~/Desktop/printer-review/cues
```

It prints the file, flashes (whole frame, quadrants and each row of the face), black frames, green in the board, the sound against its source and the sync table (the intro's cues included), then PASS or FAIL. `--frames` writes f-1, f and f+1 of every cue as PNGs.

### Pictures

```bash
mkdir -p ~/Desktop/printer-review && cd ~/Desktop/printer-review
```

**Contact sheet**, one frame every 1.5 s:

```bash
ffmpeg -v error -y -i ~/Desktop/printer-song-9x16.mp4 -vf "select='not(mod(n\,36))',scale=270:-1,tile=6x4" -frames:v 1 -fps_mode passthrough sheet.png
```

**The busy passages**, every frame, at phone size:

```bash
ffmpeg -v error -y -i ~/Desktop/printer-song-9x16.mp4 -vf "select='between(n\,0\,75)',scale=180:-1,tile=10x8" -frames:v 1 -fps_mode passthrough intro.png
ffmpeg -v error -y -i ~/Desktop/printer-song-9x16.mp4 -vf "select='between(n\,216\,243)',scale=180:-1,tile=7x4" -frames:v 1 -fps_mode passthrough g4.png
ffmpeg -v error -y -i ~/Desktop/printer-song-9x16.mp4 -vf "select='between(n\,390\,425)',scale=180:-1,tile=9x4" -frames:v 1 -fps_mode passthrough bleed.png
ffmpeg -v error -y -i ~/Desktop/printer-song-9x16.mp4 -vf "select='between(n\,472\,507)',scale=180:-1,tile=9x4" -frames:v 1 -fps_mode passthrough a-to-b.png
ffmpeg -v error -y -i ~/Desktop/printer-song-9x16.mp4 -vf "select='between(n\,772\,803)',scale=180:-1,tile=8x4" -frames:v 1 -fps_mode passthrough jam.png
```

**The words at phone size** (390 px wide):

```bash
for f in 30 122 242 362 405 487 520 580 790; do ffmpeg -v error -y -i ~/Desktop/printer-song-9x16.mp4 -vf "select=eq(n\,$f),scale=390:-1" -frames:v 1 phone-$f.png; done
```

**Loudness and peak.** Expect about -11 LUFS and a true peak under 0 dBTP:

```bash
ffmpeg -hide_banner -nostats -i ~/Desktop/printer-song-9x16.mp4 -af ebur128=peak=true -f null - 2>&1 | tail -12
```

**What cut the film.** This should list only the printer take and the intro's black:

```bash
python3 -c "import json; d=json.load(open('$HOME/Desktop/printer-song-9x16.json')); print(sorted({c['asset'] for c in d['edl']['clips']}), d['lint'], d['governor'], d['treatment'])"
```

Then look at every PNG and watch the film twice: once on the Mac with headphones, once on a phone. Listen to the intro's join into the first frame and to the splice at film 17.25 s.

### Craft

- [ ] **It loads, then sings.** The loading eye opens, flows in and shuts onto the full bar; Synergy's "Loading." is clear; the swell resolves on the first frame of the face.
- [ ] **The printer reads as singing.** The page comes out on the rising pitch and goes back in as it falls (g3 at film 6.9 s, g4 at 9.3 s, g7 in the full bleed). At phone size, the face reads as a face within 2 s.
- [ ] **It dreams between its gestures** and is awake on every glide: the mouth is clean when it sings.
- [ ] **Square edges, crafted:** the rings and tiles are flat, hard-edged, on the grid; no stripe pulses in width.
- [ ] **Sync.** In the review's table every gated cue shows "ok".
- [ ] **Words.** Every word is legible in the 390 px phone PNGs. Nothing sits in the top 300 px or under y 1440.
- [ ] **The ending.** The hard stop and PAPER JAM. land on the same frame (f786), and the whole frame freezes in silence to the end.

### Canon and tech

- [ ] **Flashes:** at most 3 a second, whole frame, each quadrant and each row of the face, measured on the decoded file. The governor is on (the sidecar's `governor`).
- [ ] **No green type:** the board's words and looks have no green. (The call's speaking border and mic dots are green by the meeting room's design: chrome, not type.)
- [ ] **No people:** the sidecar's EDL lists only `shot:printer-outward-feed-19442475` (and the intro's `gen:color:#000000`).
- [ ] **No marks:** no Zoom or Lite-Brite marks or look-alikes. The chrome is the site's own meeting room. The "in" mark is the printer's output (above).
- [ ] **Duration** 33.500 s, 804 frames, 24/1.
- [ ] **A/V sync:** the review prints the offset against the source FLAC (expect 0 ms, at most 1 ms).
- [ ] **No clipping:** true peak under 0 dBTP.
- [ ] **No black frames or decode errors** (the intro is a dark screen by design; the review knows it).

## If something fails

- **Lint errors at the start** (the export refuses to run): `node scripts/check-videostudio.mjs` section 16 names the rule. Fix it in `printer-mouth.js`; never with `--force`.
- **Flashes over 3 a second:** note the second the review names, extract it with the contact sheet command (`between(n\,A\,B)`), and find the cause. Lower the `amount` of the tiles or the `mix` of the rings there, or slow their steps. Render that span alone to check: `--span A-B --scale .5 --out /tmp/printer-check`.
- **A word late or early, or a cut off its frame:** the frames are in `printer-song.js` LINES (song frames, + 72 for the film) and `printer-mouth.js` CUTS.
- **The sound is off:** if the review's offset is not 0, compare the FLAC's checksum with the sidecar's `audio.source` and rebuild it (above).
- **It renders but looks wrong** (an empty grey tile, a frozen mouth): the proxy is missing or stale. Rebuild it (above) and render again.
- **Aaron wants a change:** cue frames, words, colours, the dream windows and the square-edge looks are data at the top of the two treatment files. Change them, run `node scripts/check-videostudio.mjs`, render a span at `--scale .5`, then the final.
