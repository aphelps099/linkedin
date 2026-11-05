# Video Studio

The All Hands music video studio: footage, edit decision lists, the compositor and the director. Each section below is owned by the module it describes.

## Media

Footage enters the studio through one index, one proxy set and one same-origin route.

| File | Role |
| --- | --- |
| `media/shots.json` | The shot index. Committed. Built by `scripts/build-shot-index.py`. |
| `media/shots.js` | Loader and queries: `loadShots()`, `createShotIndex(json)`, `srcFor()`, `lumaTrack()`, `energyTrack()`, `maxZoom()`, `conformRate()`. |
| `media/index-io.js` | Reads and writes `shots.json` in its one-shot-per-line layout; the proxy policy. |
| `scripts/build-videostudio-proxies.mjs` | 540p forward and reversed proxies plus posters into `public/videostudio/proxies/` (gitignored). |
| `server/videostudio.js` | `GET /api/videostudio/media/:key`, in Express and in the Vite dev server. |
| `scripts/check-shot-index.mjs` | `npm run check:shots`. |
| `media/robot-tracks.json` | Synergy's mouth row, tracked per source frame on every clean Synergy shot the meeting room does not track (`scripts/track-studio-robots.py`, OpenCV, from the proxies). |

### What the index covers

Every season plate in `src/meeting-room/media-manifest.json` (21), every Cutting Room source take in `src/cutting-room/catalog.json` (106) and the runtime Synthia tile (`synthia-camera-v2-listening`, which `robot-tracking.json` belongs to). Masters are deduplicated by sha256: 110 shots. Pat and the lady have no footage and never will; the index rejects them.

### Shot record

Rects are `[x, y, w, h]` in source pixels unless named otherwise. Tracks are base64 `Uint8Array`s with one value per source frame.

| Field | Meaning |
| --- | --- |
| `id` | `<name>-<sha8>`. Season plates use the manifest name (`drums-playing-4976ced8`), everything else the catalog id. |
| `aliases` | Manifest id, catalog id, catalog id without hash, repo file name. `byId()` accepts any of them. |
| `src` | Same-origin master URL. Repo files are static (`/studio/season/clips/...`); Cutting Room masters go through `/api/videostudio/media/<catalog key>`. |
| `proxy`, `rev`, `poster` | Route URLs of the 540p forward proxy, reversed proxy and poster, or null. `proxyInfo` has `w`, `h`, `frames`, `gop`, `recipe` and byte sizes. Proxies keep the full source frame: scale rects by `proxyInfo.w / width` (`toProxyRect()`). |
| `status` | See below. |
| `kind` | `plate` (season clip folder), `exact` (lip-synced meeting performance), `take` (its original master, voice included), `brand` (brand-film plates and inserts). |
| `characters` | Who is on screen. Normalised: Guitar is Kevin, drums is Operations, accountant is Arjun. |
| `stem` | The performer's stem when one band member is alone on screen: `drums` Operations, `keys` Keys, `guitar` Kevin, `voice` Synergy. Never `bass` (Pat) or `lady`. |
| `roles` | `<stem>.play` (the part is visibly played), `<stem>.hero`, `<stem>.cutaway`, `voice.lead`, `harmony` (Synthia), `shaker` (printer), `listener`, `speaker`, `reaction`, `wide`, `insert`, `banner`, `walk-in`. |
| `shotType` | `plate` (locked video-call tile), `close`, `medium`, `wide`, `detail`, `insert` (screens and cards). |
| `action` | Any of `play listen speak idle print walk applaud install type screen celebrate drink`. |
| `lipSync` | `exact` (picture and recorded voice locked), `envelope` (robot LED mouth driven by audio), `loose` (talking, not phrase-locked), `none`. |
| `width height fps duration frames` | Measured by decoding every frame. Every master is 24 fps. |
| `contentBox` | Picture minus dark static bars and the baked name strip (max of detection and the manifest's `cropBottomPixels`). `uiBaked` says what was cut, and `label` marks UI burned into the picture (the `keys-full-*` mic and name). |
| `faceBox` | `{x,y,w,h,method,hits}`. Humans: OpenCV Haar frontal face, kept only with an eye inside it, in at least 40% of samples every 12 frames; the median box. Robots: the dark glass display around the two green LED eyes (`led-eyes+glass`); `track` names the `robot-tracking.json` entry. Null for groups, inserts, details and anything not found. |
| `subjectBox` | `[x0,y0,x1,y1]`: the face spread padded 15%, joined with the motion box for players. |
| `safeCrops` | `{'9:16','1:1','16:9'}`: the largest rect of that aspect inside the content box, centred on the face (face at 40% height in tall crops), on performer plus instrument for players, else on the motion centroid, else the centre. `cropBasis` says which; `cropNotes` lists formats where the subject is wider than the crop. |
| `sharpTier`, `maxUpscale`, `detailH` | `detailH` = lines of real detail: the smallest scale whose down-and-up round trip keeps PSNR at 38 dB or better, times content height. A at 540 lines or more, B at 260, C below. `maxUpscale` is U from the plan: 1.8, 1.5, 1.2. `maxZoom(shot, renderedH)` = U x contentH / renderedH. `lapvar` is kept for reference (native and at 720 lines, content box only). |
| `energy`, `energyMean`, `motion` | Per-frame motion energy 0..1: mean absolute luma change over the content box at 320 px wide, 6 levels = 1.0, hard cuts removed. |
| `hits`, `hitPeriod` | Instrument footage only: frames of motion peaks in the busiest 20% of the picture (detrended, at least 4 frames apart, prominence 0.6 sigma). They mark the stroke, not the contact. `hitPeriod` is the median interval in seconds; `conformRate(shot, bpm)` turns it into a playback rate for any tempo. |
| `cuts` | Hard cuts inside the take (frame of the new picture). |
| `loops` | `{in, out, len, seam, method}` in frames. Best seam for 12, 24, 48, 96 and 192 frames, plus up to six other lengths with a clean seam. Seam = jump at the loop point over the median frame-to-frame change: `cut` at 1.5 or below, `xfade2` to 3, else `pingpong`. No loop crosses a hard cut. |
| `reverseClass`, `reverseWhy` | Plan section 3.2. |
| `mirrorable`, `mirrorBlockers` | See below. |
| `lumaTrack` | Per-frame mean luma 0..255 (Rec. 709 weights) of the content box, for the flash governor. |
| `rules`, `tags`, `notes`, `overrides` | Extra constraints (`baked-label-in-picture`, `mask-call-ui-mark`), search tags, human notes, and which fields a hand override set. |

### Status

| Code | Meaning | Mapping |
| --- | --- | --- |
| C | Current: approved, used by the live meeting room | Season plates and any clip `src/meeting-room` loads, unless the catalog says E or R. |
| A | Available edit | Catalog "Available edit". |
| S | Source take, usable after review | Catalog "Source take" not used by the meeting room. |
| E | Earlier version, never selected | Catalog "Earlier version" (`synergy-listening`, `synthia-listening`). |
| R | Needs review, only with an override | Catalog "Needs review" (`printer-printing`, `synthia-camera-v2-listening`). |

`createShotIndex().filter()` returns C, A and S by default; pass `{allow:['R']}` to include R. E never comes back unless asked for by `status`.

### Reverse and mirror rules

- **R0, never reversed at clip level:** anything with `play` in `action` (every instrument plate and the ensemble wide), the printer (`print`), `exact` lip sync (exact performances and their original takes), drinking. `srcFor(shot, {reverse:true})` throws on R0; only a whole-mix `Transport{kind:'rewind'}` may pass `{transport:true}`.
- **R1, reverse freely:** listening and speaking plates that are not phrase-locked, robot idles, walk-ins, applause, banner work, screens and typing. `rev` is the pre-reversed proxy, so reverse playback never needs a backwards decode. Where no reversed proxy exists (none uploaded yet, a fresh checkout; the route answers 404), the export decodes the forward proxy and numbers its frames backwards (reversed frame k is forward frame N − 1 − k), and the preview captures forward frames into the stutter cache; see The decoder and The preview.
- **Mirror:** false unless the shot is on the verified-safe list and has no blocker. Blockers: `badge` (both robots wear name badges), `guitar` and `keyboard` (handedness), `skyline` (Strategy's background), `logo` (pages, banners), `banner-text`, `screen-text`, `name-label`, `call-ui`. Safe today: People & Culture, Arjun and Linda tiles, the human exact performances and their takes except Strategy, and `drum-pad-detail`.

Hand-checked classifications live in `OVERRIDES` inside the builder so every rebuild keeps them. Contact sheets (8 frames, content box, face, crops, energy and luma strips) come from `--sheets DIR`.

### Proxies

`node scripts/build-videostudio-proxies.mjs [--cache DIR] [--jobs 2] [--only id,...] [--force]`

- libx264 High@4.0, CRF 20, `-g 12 -keyint_min 12 -bf 0 -sc_threshold 0`, 24 fps CFR, yuv420p bt709 limited range, faststart, no audio, bitexact. Height is min(540, source); width keeps the aspect. Every 12th frame is a keyframe, which the builder verifies.
- Forward, reversed (`reverse` filter, same recipe) and a JPEG poster of frame 0.
- Keys end in the first 8 hex of the file's own sha256: `<id>-540-<h8>.mp4`, `<id>-rev540-<h8>.mp4`, `<id>-poster540-<h8>.jpg`. They fit the Cutting Room key rule and are cached immutable.
- Policy (`wantsProxy`): every season plate, every Instruments, Office scenes and Screen inserts take, and every performance by Kevin, Keys, Operations, Synergy, Synthia, Arjun, Linda, People & Culture, Strategy or the printer.
- Output: `public/videostudio/proxies/` plus `manifest.json` there; the builder then writes the keys and sizes into `shots.json`. Incremental: a shot is rebuilt only when its master or the recipe changes.
- **Production upload (Aaron):** `CATALOG_UPLOAD_TOKEN=... node scripts/build-videostudio-proxies.mjs --upload [--origin https://linkedinbeats.com]` sends each recorded proxy, reversed proxy and poster with `PUT /api/cutting-room/media/<key>` (`server/cutting-room.js`, bearer token, 300 MB cap). Nothing uploads without `--upload`.

### Masters an iPhone cannot decode

Two masters are H.264 High 4:4:4 Predictive (`yuv444p`): `synergy-camera-v2-listening` (Synergy's main plate: 9,007 layer-frames of the Circle Back draft) and `synthia-listening-camera-v2`. Desktop Chromium decodes them; iOS Safari and most hardware decoders do not. Every other master probed so far is 4:2:0 (the other 24 season plates and the 11 bucket masters the Circle Back draft uses; the rest of the bucket has not been probed).

- The shot index marks them: `masterChroma:'4:4:4'` and a sentence in `notes` (`build-shot-index.py` reads the master's `pix_fmt`; `check-shot-index` requires the note and a recorded proxy).
- The preview (`element-pool.js`) and the export (`decoder.js layerStream`) always read them through their 540p 4:2:0 proxies (`shots.js needsProxy`), even with `media:'master'`.
- Where a server has no proxy for one yet, the media route answers its proxy key with the master (`X-Videostudio-Source: master`). The monitor then says so in a quiet line under the status (`shots.js mediaSource` asks with one `HEAD` per shot), the export's sidecar lists the shot under `media.standIns`, and a decode failure on such a file names the shot and this section.

**To put the proxies on production** (Aaron, in a checkout with ffmpeg, from the repo root, with the Cutting Room upload token):

```
node scripts/build-videostudio-proxies.mjs
CATALOG_UPLOAD_TOKEN=<Cutting Room upload token> node scripts/build-videostudio-proxies.mjs --upload --origin https://linkedinbeats.com
```

The first command builds every proxy into `public/videostudio/proxies/` (incremental; it fetches each bucket master once into `.cache/videostudio/`, about 300 MB of proxies in all). The encode is bit-exact, so the keys normally match the committed `shots.json`; if `git status` shows `shots.json` changed, commit and deploy it with the upload, or the site asks for keys the bucket does not have. The second sends every proxy, reversed proxy and poster the index records (330 files today; it skips any not built here). Check one afterwards: `curl -sI https://linkedinbeats.com/api/videostudio/media/<proxy key> | grep -i x-videostudio-source` should say `bucket`.

**Until then, on production:**

- On an iPhone or iPad, Synergy's main plate and Synthia's listening plate do not decode: their tiles stay the empty connecting grey in the preview, and an export stops with the decoder error above. Synergy is missing from most of the film.
- Everywhere, every proxy key falls back to its master (none is uploaded): reversed spans are decoded backwards from single-keyframe masters (0.5 to 2.8 s a seek, so the rewind does not preview in real time), and a full Circle Back export fetches 128 MB of masters instead of 35 MB and peaks at 325 MB of decoded frames instead of 64 MB, close to a phone tab's 400 MB.

### Robot mouth tracks

The meeting room tracks its own Synergy plate (`src/meeting-room/robot-tracking.json`). `scripts/track-studio-robots.py` finds the two LED eyes on every other Synergy shot with a clean display (the close-up and the typing take; the original take keeps its decorative mouth and gets none), and places the mouth row at the meeting room's own offset from the eyes, rotated with the eye line and scaled by eye distance / 70. Eyes lost in a blink are interpolated (40 of 241 frames on the close-up). `compile` reads both tables (`TRACKING`): a shot's `tracking` names the meeting room's entry, else its id names the studio's.

### Media route

`GET|HEAD /api/videostudio/media/:key`, key `^[a-z0-9][a-z0-9-]{1,110}\.(mp4|jpg|webp)$`.

1. A file in `public/videostudio/proxies/` (or `dist/videostudio/proxies/`) is served from disk.
2. Otherwise `media/<key>` streams from the Cutting Room bucket through the server: signed server-side with the same S3 settings as `server/cutting-room.js` in production, or fetched from `https://linkedinbeats.com/api/cutting-room/media/<key>` (302 followed server-side) in the Vite dev server. Signed URLs never reach the browser.
3. A forward proxy key the bucket lacks falls back to the shot's master (cached five minutes, never immutable), so the compositor plays before the upload lands. Reversed proxies never fall back: they answer 404.

Range requests return 206 with `Content-Range` and `Content-Length`; `Accept-Ranges: bytes` always. Keys ending in `-<8 hex>` get `Cache-Control: public, max-age=31536000, immutable`, others five minutes. `X-Videostudio-Source` says `proxy`, `bucket` or `master`. Same origin, so `texImage2D` accepts the frames with no CORS headers.

## EDL

The edit decision list is the film. One JSON document says which footage plays where, when and how; `compile()` turns it into a frame program that the compositor draws and the export encodes, frame for frame. Everything here is pure and runs in Node.

| File | Role |
| --- | --- |
| `edl/schema.js` | The document, `validate()` (readable `{path, message}` errors), canonical `stringify()`, `createEDL()`, `merge()`, and the effect vocabulary `FX`. |
| `edl/anchors.js` | Musical time: `resolveAt()`, `resolveSpan()`, `stepTime()`, `stepAtTime()`, `cutFrame()`, `pegFrame()`, `listAnchors()`. |
| `edl/params.js` | Params (static, keyframed, bound to the audio), eases with exact integrals, and the feature tracks: `buildFeatures()` from a render, `planFeatures()` without one. |
| `edl/remap.js` | Output frame to source time: `clipTimeMap()`, `tapeCurve()`, `transportTime()`, `speedFit()`, `hitWarp()`. |
| `edl/compile.js` | `compile(edl, {plan, shots, features, format})`, `shotIndex()`, the lint. |
| `edl/metronome.js` | `metronomeEDL()` and `expectedCuts()` for the export's scene-detection gate. |
| `layouts.js` | Layout classes per format, cell ids, nesting. |
| `moves/` | The move library: `cuts.js`, `camera.js`, `time.js`, `grid.js`, `look.js`; `MOVES` in `index.js`. |
| `scripts/check-videostudio.mjs` | `npm run check:videostudio`. |

### The document

```
EDL {version:1, song:{form, track?, post?, seed?, loop?, steps?}, format:'9:16'|'1:1'|'16:9', fps:24,
     clips:VideoClip[], board:BoardCue[] | 'song', transports:Transport[], camera?:CameraCue[],
     boardMoves?:BoardMove[], overrides:Override[], template?:bool}

VideoClip {id, at:At, len, cell, asset, z?,
  time?:{in, rate:Param, reverse, repeat?:{unit, count?, pingpong?, vary?, loop?}, freezeAt?, tape?, map?},
  frame?:{crop?:{[format|'all']:Rect}, zoom, cx, cy, rot, dx, dy, opacity:Param, mirror?:'x'|'y'|'xy'},
  fx?:[{type, ...Param}], chrome?:{name, role, mic, speaking:Param, toast, banner, cameraOff},
  origin?, scene?, signature?, why?}
BoardCue  {id?, at, len, text | {ref}, font?:'peg9'|'peg5'|'peg3', k?:1-4, reveal?, release?, palette?, fx?, cell?, z?:'over'|'under', ghost?:0-.5}
          ghost: the screen as a ghost (only its letters, flat at that intensity, on true black)
        | {type:'psych', id?, at, len, look, params?:{name:Param}, seed?, fade? (steps, at least 2; 4), cell?}
          psychedelic imagery on the dot grid (pegboard/psych.js), under the board's type: see Psych cues
Transport {id?, at, len, kind:'rewind'|'tapestop'|'jump', audio:true, rate? (4), from?:At, seconds?}
CameraCue {id?, at, len, zoom, cx, cy, rot, dx, dy:Param, fx?, board?, clock?}  the whole composite; board:true carries the Peg Board with it;
          clock:'film' runs it on the film's own frames instead of the song time a transport shows (the rewind's scanline wobble)
BoardMove {id?, at, frames? (3-24, default 4), ease? (default inOutSine), align?:'start'|'end', why?}
          the only place the board's rect may change (lint G14): it eases from the rect the layout gave it on the frame
          before the move to the rect the layout gives it on the move's last frame, starting on `at` (start: a full-board
          moment grows out of the home) or landing on it (end: the board is home on the cut); the panel fades with it
Override  {target:'<clip id>'|'cue:<id>'|'transport:<id>', set?:{'dotted.path':value}, rule?:'G1'-'G13'|'S4', note}
```

Units: `at`, `len`, `off` and keyframe positions are 16th steps of the plan; the plan's `timing` table turns them into seconds, so any tempo works and a step need not be a whole number of frames. `frames` are output frames. Source times (`in`, `map`, `freezeAt.src`) are source seconds. `rot` is degrees, clockwise on screen. `cx`, `cy` are 0..1 of the crop. `dx`, `dy` and effect lengths are output pixels.

- **asset**: `shot:<id or alias>` from the shot index; `role:<stem>.<kind>` (`role:drums.hero`: a shot whose `roles` name it, else the stem's shots by action, sharpest tier first); `gen:black`, `gen:white`, `gen:color:#rrggbb`, `gen:board` (the Peg Board drawn into the tile), `gen:camera-off` (Pat's tile), `gen:feedback` (the previous output frame, for Droste).
- **crop**: per format, else `all`, else the shot's `safeCrops` entry nearest the cell's aspect, else its `contentBox`. It is then fitted to the cell's exact aspect inside the content box: never stretched, never outside the picture.
- **board**: `'song'` draws the song's own screens (`buildScreens()` in `pegboard/choreo.js`). A list of cues replaces them; a cue with `text:{ref:'song'}` (no `len` needed) keeps the song underneath, `{ref:'song:impact#0'}` takes one song screen, `{ref:'lady:tag#0'}` and `{ref:'line:hook#0'}` take her words or a sung line with their timing. A cue with a `cell` draws inside that tile (`z:'over'`). `merge()` keeps a `'song'` board under any cues a move adds.
- **psych**: a `{type:'psych'}` cue is imagery, not type: it never becomes a screen, so the song's words stay as they are and win over it (Psych cues, below).
- **overrides**: `set` patches a clip, cue or transport by path. `rule` waives one lint rule for that target (it becomes a warning) and needs a `note`. Templates (`template:true`) ignore waivers.
- **stringify** writes keys in one fixed order and one clip per line, so `stringify(parse(s)) === s` and key order never changes the bytes.

### Anchors

`At` is a step number, or `{anchor, off?, frames?, hit?}`: the anchor's step, plus `off` steps, plus `frames` frames. A `frames` offset shifts both ends of a span, so back-to-back vocal cuts at `word − 1 f` still abut.

**The timing rule.** One rule for the whole picture, tested on every step of every track (`check-review-video` section 3, `check-videostudio-export` section 3):

- **Cuts** land on `round(t·24)`: within half a frame of the beat, early or late (at 92 and 130 BPM a step is not a whole number of frames, so up to ±20.8 ms).
- **Hits**, picture events tied to a transient (a flash, the ignition, the impact, a punch-in, a peg popping on a syllable, a kick or a clap), land on the frame that holds the transient's audible onset, `floor((t + L)·24)` (`hitFrame`): the picture leads the sound by 0 to under one frame and is never late. Mark a clip's `at` with `hit:true` (`hitAt(step)`), or a keyframed Param with `{keys, hit:true}`.
- `L` is `AUDIO_LATENCY` (`anchors.js`): the engine's sound leaves its master bus 720 samples at 44.1 kHz (16.33 ms) after plan time, because the glue compressor and the limiter look ahead. The look-ahead is a whole number of samples, so a live context at 48 kHz runs 768 samples, 16.00 ms: the preview's hits lead by a third of a millisecond more, never less. Measured per track: an impulse through the drum bus peaks at 16.33 ms, and every kick of each track's song reaches 40 dB under its peak 16.33-16.36 ms after its step (Circle Back, Humbled and Honored, Hustle). The export gate measures it again on every run.
- The P3 claim that the picture leads by "0-25 ms" held only against plan time; against the sound as rendered, `round(t·24)` was up to 20 ms late on 192 of 383 steps at 92 BPM and 236 of 511 at 130 BPM. Cuts keep `round`; everything tied to a transient is a hit.

| Anchor | Moment |
| --- | --- |
| `bar:n`, `step:n` | The downbeat of bar n; step n. |
| `section:<name>[#k]` | First step of the section (`section:Drop B`, `section:drop-b`). |
| `cue:impact` `cue:choke` `cue:unmute` `cue:sink` `cue:stop` `cue:start` `cue:end` | 40.000, 39.000, 4.000, 46.000, 59.000 s in the Drop Edition. |
| `lady:<role>[#n]`, `lady:r<k>[#n]`, `lady[#n]` | Her events by role (`ladder tag impact punct sink stop`) or ladder rung, at the engine's own clock (fractional 32nds included). |
| `word:<kind>[#n]`, `line:<kind>[#n]`, `stutter[#n]` | Synergy's n-th word in lines of a kind (`host verse hook answer any`), the n-th line, his stammer. |

`#-1` is the last. Moves write anchors, not seconds, so a template follows any post.

### Params

`Param = number | [[k, v, ease?]...] | {keys, unit:'steps'|'frames'|'seconds', hit?} | {bind, scale, base, attack, release} | {mul:[...]} | {add:[...]}`

- `hit:true` keys are hits: each key sits at the start of the frame that holds its moment's audible onset (`hitFrame`), so a punch-in shows on the frame its snare is heard in (snarePunch writes them, the track's laid-back backbeat included: Humbled and Honored plays it 18 ms behind the beat).

- A key's ease shapes the segment that arrives at it. Eases: `linear inQuad outQuad outExpo inOutSine step outBack`; each has an exact antiderivative, which is how rates integrate.
- Keys in `steps` sit at `stepTime(at + k)`; in `frames` at the clip's cut frame plus k.
- `bind`: `kick`, `kickLevel`, `voice`, `voices`, `clap`, `roll`, `stem:<name>`, `eq:<band>`. Value = `base + scale · envelope`, a one-pole follower with `attack` and `release` in seconds. `voices` is the loudest voice stem on each frame (Synergy, the lady, a `choir` stem when the engine has one); `clap` is 1 on the frame that holds each backbeat hit as it sounds (`backbeatHits`: the claps, snaps and snares each track's kit plays, its late backbeat included, or the plan's own `plan.claps`).
- **Feature tracks** `{fps, frames, source, kick, kickLevel, roll, clap, stems:{drums bass keys guitar voice lady}, eq}`, every series a `Float32Array` per frame. Frame g is song time g/24, read 10 ms ahead like the equalizer. `kick` is 1 on the frame that holds each of the plan's kicks (a hit; eq.js `kickSteps`, the same kicks the engine plays). `buildFeatures(plan, render)` reads `engine.render(..., {tune:{stems:true}})` (master on channels 0-1, stems on 2-7): stem RMS mapped from -60 dBFS (0) to -6 dBFS (1), the drums' 35-150 Hz band as `kickLevel`, and master bands from `eqTrack`. `planFeatures(plan)` is the fallback with no audio: levels from the plan's players, words and lady events, silence in the choke.

### Time

For a clip with cut frame F0 (t0 = F0/24), the forward source time is

```
S(t) = in + dir · ∫[t0, t] rate(τ) · tape(τ) · live(τ) dτ        dir = −1 when reversed
```

- The first frame shows exactly `in`. Keyframed rates integrate in closed form. A rate under the tape, a freeze or a bind is integrated with 6-point Gauss-Legendre on pieces of at most 50 ms between its breakpoints: about 1e-15 s, and nothing is stepped frame by frame, so nothing drifts.
- **tape**: the song's varispeed from `plan.tape`, the same curve the engine's delay line plays. Sink In: pitch 1 → 0.5 across bar 23 (content time `t − .25·D·u²`). The tape stop: 1 → 0 over 0.4 s, then a hold. R1 clips follow it exactly (0.5× means each source frame holds two output frames). Instruments freeze instead.
- **reverse**: the source runs backwards from `in`. The layer says `reverse:true` and gives `proxyFrame = frames − 1 − srcFrame` in the reversed proxy and `proxyTime` at that frame's centre: `duration − srcTime`, snapped so a frame boundary never picks a neighbour.
- **repeat** `{unit, count, pingpong, vary, loop}`: the slice restarts every `unit` (steps, `{steps}` or `{frames}`), `count` plays (the last runs on), each repeat showing the first slice's frames. Ping-pong plays odd repeats backwards, frame for frame (83 → 72 after 72 → 83). `vary[k]` changes repeat k (`zoom cx cy rot mirror`). Repeats after the first come from the stutter cache when the slice is 12 source frames or fewer. `loop:true` marks a plate loop on beats rather than a stutter.
- **freezeAt**: local steps (hold from there), `{at, len}` (hold, then play on from the held frame), or `{src}` (one still frame for the whole clip).
- **map** `[[localStep, srcSeconds], ...]`: an explicit piecewise-linear time map; hit warp writes it.
- **speedFit(src, slot)**: rate = src/slot inside 0.5-2; faster, the source is trimmed; slower, the clip ends with the source.
- **hitWarp**: a dynamic program puts the most hits (`shot.hits`, source frames) on 8ths (or the plan's kicks) with every local rate inside 0.85-1.15; matched hits land exactly.
- **Transports** remap song time for the whole composite: `rewind` shows `Tfrom − 4·(t − Ta)` for at most one beat with every layer's direction flipped, the printer and the instrument plates holding their frame at `Tfrom` (plan §2: they freeze, R0 footage never plays backwards under them); `tapestop` shows `Ta + τ − τ²/2S`, then holds; `jump` shows `Tfrom + (t − Ta)`, another moment forwards (the cold open). The board follows the same time, except through a tape stop: her "Full stop." is routed after the tape (she stops it, it does not stop her), so `board.time` keeps the song's own clock there while the picture slows to its hold.
- **What the sound does** (`soundOf`, on every transport and frame as `transport.sound`): a rewind is `reversed` only where the plan rewinds the mix over the same span, at the same rate, from the same source time (`plan.transports`, drop.js `withColdOpen`); a jump is `copied` where the plan copies that moment's sound there (`plan.coldOpen.impact`); either is `silent` once the tape stop's hold has started and her stop phrase (after the tape) has stopped sounding, else `forward`.
- **The cold open** (plan §2 rows 0:0-0:7, `plan.coldOpen`): frames 0-17 are a `jump` to the drop's own impact frame, `hitFrame(impact)` (the board ignites for one frame and BACK. settles, exactly as at the drop, while the sound is the drop's impact cut from its own render without Synergy, `engine.js coldSourcePlan`). The board shows only what is heard: inside a jump whose sound is copied, `board.time` holds on the frame before his first screen (`compile.js jumpHold`), so BACK. stays up and his Drop A "LET'S" never lights there (it used to, silently, on Circle Back frames 12-17, Humbled and Honored 16-17, Hustle 11-17); frames 18-23 are the plan's `rewind`, the last second before the choke at 4×, picture and sound reversed together, the board shrinking back to its home over frames 21-24. Inside a rewind the board looks back, not ahead: frame f plays the song from v down to v − rate/24, so it shows the board at v − rate/48, the middle of that span (`board.time` is set so the compositor's own look-ahead lands there); frame 18 starts on the choke, where her tag starts, and shows the ladder's LET'S, never the tag's "L"; from frame 24 the song as written.
- **The ending** (plan §2 row 29): the tape stop's curve, then its hold, for as long as her "Full stop." sounds in the file (from its onset to `plan.stop.end`, else her envelope's end, plus the codec's 5 ms and the engine's latency: `anchors.js stopFrames`). "FULL STOP." stays on the board the whole time, typed in full, sliding down 2 pegs and dimming to about 0.56 of full light (choreo `STOP_DIM` .7 on the exposure, .8 on the pegs). Black starts on the first frame after her (Circle Back f1437, Humbled and Honored f1492), never before the curve has run. The last two frames are the loop seam's ghost BACK.: frame 0's BACK. screen, its letters only, flat at I .08 on true black (a board cue `{text:{ref:'song:impact'}, ghost:.08}` over a black tile carrying the ignition's peg-video pitch, so the ghost lights frame 0's own pegs). Where her line runs into the last two frames (Hustle: she is heard to f1416 of 1418), the ghost takes only what is left (f1417) and there is no true black. Synergy's held close-up keeps his eyes open: the treatment moves the closing clip's source by the fewest frames that keep the slow-down and the hold two frames clear of his blinks (`robot-tracks.json` `blinks`, from `scripts/measure-robot-eyes.py`).

### Layouts

Each class is laid out per format, never cropped from another. 12 px from every edge and between tiles, 12 px corners (BOARD is full bleed). Cell ids are `<class>.<i>` in reading order; `full` is the frame in any class.

Each format gives the Peg Board one **home** (`HOME`): a single rect that every call layout shares, so the board's panel never moves or changes size on a cut, and the tiles are laid out around it and fill the frame (only gutters are left black: 88-97 % of every frame is tiles and board; the last review found 30-45 % dead black in the 9:16 grids). The home sits inside the platform-safe band of its format (`SAFE`, from `pegboard/font.js` FORMATS): 9:16 between y 300 and 1440 (clear of the Reels, TikTok and Shorts header and caption), 1:1 between 60 and 900, 16:9 between 54 and 1026. So whenever the song has words, the board has somewhere to light (lint G13). L1 keeps its whole frame and lays the home over the picture as a panel (`boardOver`), below the face; the panel stays up between screens (its sockets, empty), as it does in every grid. An empty frame between clips keeps the home.

Only the full-board moments leave the home: BOARD+STRIP (the screen share) and BOARD, and a full-frame picture (the ignition's peg video, the choke's black). They grow out of the home and return to it through an authored board move (`edl.boardMoves`, at least 3 frames, eased, on the beat), never a jump (lint G14). The draft grows the board on a moment's first beat, over the moment's own picture, and lands it home on the cut that ends it, so a moving board never passes over the call's tiles (or Synergy's mouth row).

| Class | 9:16 (1080×1920) | 1:1 (1080×1080) | 16:9 (1920×1080) |
| --- | --- | --- | --- |
| home | x 12-1068, y 1098-1440 | x 12-1068, y 588-828 | x 1422-1908, y 54-1026 (the column) |
| L1 | 1056×1896, the home over it | 1056×1056, the home over it | 1896×1056, the home over it |
| split | 1056×1074 above the home, 1056×456 under it | 1056×564 above, 1056×228 under | 2 of 693×1056 |
| stack3 | 2 × 1056×531 above, 1056×456 under | 2 × 1056×276 above, 1056×228 under | 3 columns of 458×1056 |
| G4 | 2 × 1056×531 above, 2 × 522×456 under | 2 × 522×564 above, 2 × 522×228 under | 2×2 of 693×522 |
| G6 | 2×2 of 522×531 above, 2 × 522×456 under | 3 × 344×564 above, 3 × 344×228 under | 3×2 of 458×522 |
| G9 | 3×2 of 344×531 above, 3 × 344×456 under | 3×2 of 344×276 above, 3 × 344×228 under | 3×3 of 458×344 |
| BOARD | the frame | the frame | the frame |
| BOARD+STRIP | banner y 12-66; the home grown up to y 78 (its sides and bottom stay); 3 × 344×456 under | banner; the home grown up to y 72; 3 × 344×228 under | 3 tiles of 450×344 in a column on the left; banner; the home opened left to x 474, y 72-1026 |

The tiles under the home in 9:16 sit beneath the platform caption: footage may, type may not.

Cells nest with `>`: `split.1>G4.2` (a 2×2 inside the lower half: breakout rooms), `stack3.1>g2x4.5` (a generic grid: cell split). Nested grids keep the gutter with no outer margin. `cellRect(format, id)` returns `{id, cls, x, y, w, h, r}` or null.

### Moves

Each move is a pure function `move(ctx) → {clips, board?, transports?, camera?, notes?}`, a patch for `merge()`. `ctx = {plan, shots, format, at | section, len, cell | cells, pool, seed, id, scene, features, ...options}`. Every in point and choice comes from the seed; anchors keep them portable. Moves that would break policy refuse and say why in `notes` (a boomerang on R0, a kaleido on a robot, a ramp on an instrument, a warp on Synergy).

| Family | Moves |
| --- | --- |
| `cuts.js` | downbeatCut, offbeatCut, vocalCut (word − 1 f), jCut, lCut, matchCut (faceBox eye-line, scale within ±10 %), jumpCut |
| `camera.js` | slowPush, crashZoom (3 frames, 4 % overshoot, radial blur), snapLadder (never past maxZoom), snarePunch, whipSlide, hatRoll (±2° per 8th with corner-covering zoom) |
| `time.js` | speedFit, hitWarp, tapeCoupling, speedRamp, freezeLabel (PEG-5 name and role in the tile), stutter, retriggerRoll (the ladder is the cut list), boomerang, rewind, tapeStop |
| `grid.js` | gridBloom, gridCollapse, cellSplit (one decode), breakoutRooms, freezeTheCall, reactionCanon, dubDelay, speakerChase, leaveMeeting |
| `look.js` | poorConnection, pegTakeover (Ignition on the impact), drosteDive, kaleido, rgbSplit, irisToEye |

Not yet: graphic match (needs circle centroids in the index) and the cross-tile handoff.

### The frame program

`compile(edl, {plan, shots, features?, format?, target?:'desktop'|'mobile', table?, frames?})` returns:

```
program {version:1, format, width, height, fps:24, frames:N, duration,
  plan:{form, totalSteps, duration},
  clips:[{id, shotId, asset, cell, from, to (frames), step, restarts:[frames], scene, signature}],
  transports:[{id, kind, from, to, rate, seconds, sourceTime}],
  board:{mode:'song'|'cues', screens, cells},        screens: choreo.js screens, sorted, one at a time
  cuts:[frame, ...],                                 every frame the picture changes, ascending
  decode:{perFrame:Uint8Array(N), max, perBar:[{bar, from, to, max, worstFrame, distinct}],
          streams:[{key, shotId, proxy:'fwd'|'rev', spans:[{from, to, srcTime, peak}]}],
          prefetch:[{frame, preroll, shotId, proxy:'fwd'|'rev'|'still', srcTime, srcFrame?}], limits:{mobile:4, desktop:8}},
  lint:{ok, errors:[{rule, message, clipId?, path?, frame?, frames?}], warnings:[...]},
  frame(f), compileFrame(f), hash(), stats:{compileMs, layers}}

Frame {f, t (f/24), time (the song time shown: differs only inside a transport), layout (class or 'full' or null),
  transport:null | {id, kind, phase 0..1, rate},
  camera:null | {id, zoom, cx, cy, rot, dx, dy, board, matrix, fx},     composite: output px -> composite px
  board:{time, screen (index into board.screens, or -1), rect (the home, a full-board moment's region, the frame, eased inside a board move, or null when dark),
         over (laid over the picture: L1's panel, a moving board), panel (1 the board with its sockets, 0 only its light over footage, between inside a move),
         move (the board move easing it, or null), dark, banner, cells:[{screen, cell, rect, z}]},
  layers:[Layer, ...]}                                             bottom to top

Layer {clipId, shotId, asset, kind:'video'|'generated', gen,
  srcTime (forward source seconds), srcFrame, reverse, proxyTime, proxyFrame,
  source:'stream'|'stutter'|'still', repeat,
  cell:{id, x, y, w, h}, radius, crop:{x, y, w, h} (source px),
  transform:{zoom, cx, cy, rot, dx, dy, mirror, matrix:[a, b, c, d, e, f, 0, 0, 1]},
  opacity, fx:[{type, ...numbers}],
  chrome:{name, role, mic:'on'|'muted', speaking 0..1, toast:null|{text, age, remaining}, banner:null|text, cameraOff},
  robot?:{id, mouth:{x, y, angle (rad), scale, px, w, h}, level},   the tracked mouth row in output px; px: output px per source px; level 0..1: his voice
  canon?:{synergy:true}, held?:'printer',
  trail?:{of, k, blend}}                                           a trail's copy k of clip `of` (clipId '<of>~k'): no chrome, no mouth row
```

- **Draw order**: z, then the later clip on top, then EDL order. A layer that is opaque, unrotated, unslid and at zoom 1 or more hides what is under it in its cell (a full-frame one hides everything), so hidden footage never costs a decode.
- **matrix** maps an output pixel to a source pixel, row-major: `[sx, sy, 1]ᵀ = M·[x, y, 1]ᵀ` (GLSL `mat3` is column-major: transpose it). `M = T(crop.x + cx·crop.w, crop.y + cy·crop.h) · S(crop.w / (cell.w·zoom)) · R(−rot) · Mirror · T(−(cell centre + d))`. Divide by the shot's width and height for UVs; for the reversed proxy, sample `proxyFrame` at the same UVs. Outside the cell, the layer is masked by the rounded rect (`radius`). For generated layers the matrix maps to cell-local pixels of the generated texture.
- **srcTime** is exact and continuous (robot tracking and mouth brightness read it). To show a frame, use `proxyFrame` (export) or seek to `proxyTime` (preview); both are frame-exact.
- **Board**: pass `board.time` to `stage.draw()` / `paint()`; choreo's own half-frame lead does the rest. `gen:board` layers are the board inside a tile.
- **Chrome** is drawn by the compositor above the layer and must keep clear of `robot.mouth`.
- **Synergy's mouth level** (`robot.level`): the voice stem from the features (`MOUTH_LEVEL`: attack 12 ms, release 90 ms), only while he sings or speaks one of his own words (plan words and stammers, from a frame before to 120 ms after); 0 otherwise. The vocoder also carries her ladder and BACK., and plan §2 keeps his mouth dark through Sink In.
- **Lights out**: when every tile of a layout is black (`gen:black`, `gen:color:#000000`), the call has gone dark and its board with it (`board.rect` null, `board.dark`); a full-frame black keeps the board (the choke's tag on bare sockets). Never while her stop phrase still sounds (choreo `stopDarkAt`): "FULL STOP." keeps its board over any tiles. The ending's true black from the first frame after her is this.
- **The camera and the board**: a camera cue moves the call, not the board. Unless the cue says `board:true`, the compositor leaves the board out of the composite and draws it after the camera, fixed in its region, so a push, a roll or the Droste dive never carries the words out of frame.
- **Decode schedule**: a decode is one moving stream of one shot in one direction; layers of that stream within 12 source frames of each other share it (cell split, kaleido, the canon). Held frames need one decode, once; stutter repeats need none. `prefetch` is in preroll order, each one beat early.
- **compileFrame(f)** recomputes one frame on its own; it equals `frame(f)`. `hash()` is FNV-64 over every frame.

### Effects

Each fx entry is `{type, ...}`; numeric parameters are Params, evaluated per frame. Compile drops an effect at its identity value. "Warps" effects are refused on Synergy.

| type | Parameters (default) | Identity | Warps |
| --- | --- | --- | --- |
| `zoomBlur` | amount (0): 0..1, the 8 taps reach this fraction of the way to the centre; cx, cy (.5): centre in the cell | amount 0 | yes |
| `dirBlur` | px (0): blur length in output px; angle (0): degrees, 0 along +x | px 0 | yes |
| `mosaic` | px (0): block size in output px, blocks aligned to the cell origin | px ≤ 1 | yes |
| `chromaDrop` | amount (0): 0..1, 1 keeps luma only | amount 0 | no |
| `saturation` | amount (1): multiplier, 0 grey, .4 is -60 % | amount 1 | no |
| `rgbSplit` | px (0): red moves +px along angle, blue -px, green stays; angle (0): degrees | px 0 | yes |
| `fold` | axis ('x'): `x`, `y` or `xy`; UV fold about the cell centre, x reflects the left half onto the right | never | yes, mirrors |
| `tile` | cols (2), rows (2): copies of the source inside the cell; mirror (1): alternate copies mirrored (the 2×2 kaleido), one decode | 1×1 | yes, mirrors when mirror is 1 |
| `iris` | r (1): 0..1 of the cell half-diagonal, 1 open, 0 closed; cx, cy (.5): centre in the cell; feather (2): output px; space ('cell'): with `source` the centre is given in source px and compile maps it through the layer, so it follows any zoom | r ≥ 1 | no |
| `droste` | depth (0): 0..3 levels of the previous output frame nested in the cell, fractional is partway in; scale (1/3): the inner frame's size as a fraction of the cell; cx, cy (.5) | depth 0 | yes |
| `pegVideo` | mix (1): 0..1 footage to peg video; pitch (12): output px between pegs; levels (6): blue levels of luma^gamma; gamma (1.4) | mix 0 | yes |
| `scanline` | amount (0): line darkening 0..1; wobble (0): horizontal displacement in output px; period (6): output px per line pair | both 0 | yes |
| `echo` | taps (0): trail copies; frames (1): frames between copies; decay (.6): each copy's opacity relative to the one before | taps or decay 0 | yes |
| `breathe` | px (0): block size in output px, meant to be bound (`{add:[{bind:'voices'}, {bind:'clap'}]}`); cx, cy (.5): the centre the blocks grow from. Between octaves the two nested grids (2^n and 2^(n+1) px) crossfade, so a size that follows the voices breathes instead of stepping | px ≤ 1 | yes |
| `paletteWash` | mix (0): 0..1 the original to the wash; hue (0): the duotone, 0 Peg Board blue (#2B78FF), 1 violet (#8C52FF), 2 warm (coral, #FF7366), fractional between. Luma onto the duotone with luma kept (a zero-luma tint, strongest in the shadows, none at black or white), never green | mix 0 | no |
| `trail` | taps (0): copies of the clip as it was earlier, its own earlier source frames and transforms (at most 6); frames (2): output frames between copies; decay (.5): each copy relative to the one before (bind it to `clap` to smear on the beat); blend ('lighten'): a copy only brightens, or 'over'. A layer effect: compile expands it into copies (never on a camera cue) | taps < 1 or decay 0 | yes |
| `radialFold` | wedges (6): mirrored wedges about the centre, a kaleidoscope; angle (0): degrees, the wedges turn with it; cx, cy (.5). A point the turn carries out of the cell reflects back in | wedges < 2 | yes, mirrors |
| `pegBloom` | amount (0): 0..1 how far the footage has turned into pegs from the centre out; cx, cy (.5); band (.2): the front of peg-wide pixel blocks ahead of the pegs; reach (0: the cell's farthest corner): output px amount 1 reaches; pitch (12), levels (6), gamma (1.4) as peg video; space ('cell'): 'frame' gives cx, cy in frame units (the board home) and compile maps them into the cell with reach the frame's farthest corner, so one circle grows across every tile | amount 0 | yes |
| `chromaDrift` | px (0): red, green (at half) and blue each displaced along directions 120 degrees apart; angle (0): degrees, drift it slowly with keys; radial (0): px at the cell corner, red outwards and blue inwards from the centre | px and radial 0 | yes |

Mirroring a whole layer is `frame.mirror` (in the matrix), not an effect. Camera cues take the same effects over the whole composite, in frame coordinates.

### Psych cues

Psychedelic imagery on the dot grid: `{type:'psych', id?, at, len, look, params?, seed?, fade?, cell?}` in `edl.board` (`schema.js PSYCH`). The looks, their params and their rules are `pegboard/psych.js` (Peg Board README): `ripples`, `spiral`, `pinwheel`, `moire`, `plasma`, `mandala` (`fold` 6, 8 or 12), `lissajous`, `footage`. Every param is a Param (keyed from the cue's own `at`, or bound: `{bind:'voices'}`); `seed` turns and offsets the look; `fade` (steps, at least 2, default 4: a beat at 4/4) ramps it in and out, so a look never switches on or off in one frame.

| Where | How it draws |
| --- | --- |
| no `cell` | Painted into the board's own region on every frame, whatever the layout gives it: the home strip in every call layout, the share's grown board (`BOARD+STRIP`), the whole frame (`BOARD`). It goes under the song's words: every lit peg is type and is never relit, a moat a peg wide stays dark, the pattern dims within 5 pegs and runs at .55 while words are lit. |
| `cell` | Its own peg board, a panel (sockets and all) over that tile, `'full'` for the frame; drawn after the layers and their chrome, laid on at the cue's fade (opaque once it has faded in), so the picture dissolves into the dot grid and back rather than cutting to the panel; the governor predicts the same blend. When it covers the board's region, the board is drawn over it with its own panel, so the type still wins. |
| `footage` | The picture under the region (the composite as drawn so far) averaged to one value per peg (4 × 4 taps, `PEGS_FS`) and read back; best as a `cell` over a tile, which the tile's footage then takes over. Over the home in a call layout there is nothing under it. |

Compile puts the live cues of each frame on `frame.board.psych`: `{cue, look, seed, cell, rect, time, fade, params, drive}`, on the board's own clock (`board.time`, so a rewind runs it back and the tape stop holds it), the params evaluated for that frame and `drive` = `{beat, voice, clap}` from the program's feature tracks (`buildFeatures`, else `planFeatures`). The compositor and the governor paint exactly that. The governor's prediction includes every look (footage is predicted as the picture it takes over). Nothing lights at true black (the choke's frames, exposure 0). G11 refuses a psych cell over Synergy's mouth row, and counts a region psych over the home the way it counts lit words.

```json
{"type":"psych","id":"haze","at":{"anchor":"section:Breakdown#0"},"len":32,"look":"mandala","params":{"fold":12,"level":[[0,.5],[32,.9]],"breath":1}}
{"type":"psych","id":"kevin","at":192,"len":16,"look":"footage","cell":"G6.2","params":{"sharpen":1.2}}
```

### Lint

Errors block export; warnings do not. Each finding carries a rule, a sentence, and the clip and first frame when it has them.

| Rule | Checked from the EDL | Level |
| --- | --- | --- |
| G1 | Adjacent scenes (clips tagged `scene`) differ in layout class where they meet. | error |
| G2 | Signatures: the same one not within 16 bars, at most 4, one Droste; director-placed ones at most one per 8 bars. | warning |
| G3 | A playing plate on screen while its stem's level is at or under .15 (needs features). | warning |
| G4 | Scenes start on bar lines, ladder retriggers or the choke. | error |
| G5 | Live decodes at once: over 8 is an error, over 4 a warning (an error with `target:'mobile'`). | error / warning |
| G7 | R0 shots never play backwards except inside a rewind whose sound really reverses with them (a `plan.transports` rewind with `audio:true` over the same span; checked on every frame: reverse, negative rates and ping-pong all count). Rewinds: at most one beat, at most two, `audio:true`; one the plan does not reverse the sound in is a warning (only generated and R1 layers may run backwards there; printer and instruments hold). A `jump` whose sound plays on is a warning. Instruments are hit-warped (0.85-1.15) or frozen: never slowed, ramped or tape-coupled. | error / warning |
| G8 | A slice plays at most 4 times; the third repeat varies; three identical clips in a row in one cell. Continuations across re-layouts and generated tiles are not repeats. | error |
| G9 | Custom board cues hold at least max(0.75 s, characters / 15). | warning |
| G10 | Upscale `zoom · camera zoom · cell.h / crop.h` stays at or under U (A 1.8, B 1.5, C 1.2). A mosaic or breathing mosaic of 8 px or more, or peg video, is exempt. | error |
| G11 | Pat never on video; the lady never gets a face; type is never green; robots, instruments and unflagged shots are never mirrored (a frame mirror, a mirrored tile, a fold or a radial fold); no warping effect on Synergy (the palette wash is colour, not a warp: his face takes it, his mouth row never does); nothing covers his tracked mouth row, the board included (L1's panel, or a still board a camera pushes his face under, while words are lit). | error |
| G12 | Loop films (`song.loop`): the last frame's layout and board screen match frame 0's (a ghost of frame 0's song screen counts as the same). | warning |
| G13 | Whenever the song's board has lit words (a word reached by the frame that holds its sound, not yet ended, the board not dark), a board is on screen: the layout's region (held still under a camera that does not own it), or a `gen:board` tile the camera keeps half in frame; a camera that owns the board must keep 90 % of the region in frame. Lights out is exempt. Not waivable. | error |
| G14 | The board holds still: its rect may change between consecutive frames only inside an authored board move (`edl.boardMoves`, 3 frames or more, else a schema error), and its panel (the sockets behind the type) comes or goes only inside a move, where a transport cuts to another moment, or from dark (lights out, the choke's true black). Not waivable. | error |
| S4 | Shot status E never loads; R loads only with an override (`rule:'S4'`). | error |
| schema, S2, S3 | Structure; clips shorter than a frame; clips running past their source. | error / warning |

G6 (flash governor) needs the rendered luminance and stays with the board and the compositor.

G10 uses the real upscale. For a crop that spans the content height (tall and square tiles) it equals the shot index's `maxZoom(shot, renderedH) = U · contentH / renderedH`; for wide tiles the crop is shorter than the content box, and this is the stricter, correct number.

### The metronome

`metronomeEDL(plan, {format, every = 4, sources = [black, white]})`: a full-frame cut every N steps, alternating two generated colours, with no board. `expectedCuts(plan, edl)` gives `round(T(step)·24)` for every cut; the export gate compares those with ffmpeg `scdet`.

### Checks

`npm run check:videostudio` (1513 checks, about 16 s; `--render` adds a real stems render in headless Chromium, about 80 s; `--dump DIR` writes the sample film's EDL and fixture shots): schema round trips; anchors against the real Drop Edition and Sound check plans and a 128 BPM plan; eases against an independent quadrature; rate integration, reverse, stutter, ping-pong, freeze and tape coupling against closed forms (errors under 1e-14 s); the metronome's cuts on every plan; every layout in every format; every move to a clean EDL; every policy violation caught; a 60 s film (133 clips, 5,793 layers) compiled twice to one hash, the best of 7 warm compiles inside the 100 ms budget (a loaded machine only adds time, so the best run is the compile's own cost; the median is printed); every call layout's board at its format's one home, inside the safe band, the tiles and board covering 88 % of the frame or more, and every Drop Edition screen and lady phrase at k 1-3 lit inside the band on the screen share and the full-bleed board; every stutter's whole words on one page, in the home, the share and the full board; G14 (a full-board moment cut in and out without a move fails twice; with moves it grows over 4 frames from the beat and lands home on the cut, eased, seek-safe; a 2-frame move is a schema error; a panel that comes and goes on its own fails); G13 (a camera that owns the board and pushes it out fails; one that does not holds it still; lights out); Synergy's mouth level on his words, at rest between them and through Sink In; the real `media/shots.json` when present; the new effects (12: each validates, compiles away at its identity, binds to `voices` and `clap`; the peg bloom in frame units; the trail's copies are the clip's own earlier frames, over it, sharing its decode, seek-safe; G11 refuses every new warp on Synergy and a radial fold on anything not mirrorable; the treatments by track) the Offsite cut on the real shot index (13: every track and format clean, byte-stable, every new effect used, no warp on Synergy; on every track every tile change inside a scene on an "and" and dissolving in, at least 40 % of the footage on screen slowed and only R1 footage slowed; on Offsite a psych look in the board's region on 80 % of the frames or more, a full-frame look on 48 frames or more with no Synergy on screen, the BACK. bloom a mandala on the impact's full board) and psych cues (14: the eight looks validate, bad cues caught by path, byte round trip; on the board's clock with a beat-long fade, keyed params and the drive's beat, claps and voices; a cell carries its rect; the same program twice; G11 over Synergy's mouth row; live across the choke at exposure 0; never a screen) and the band and the river (15, 183 checks: every track on its own form, cast by the post with the voice bank, the sample and three picks per track (Circle Back fixtures 4, 44, 59; Humbled and Honored 0, 5, 13; Hustle 1, 25, 38; Offsite 24, 47, 14), in all three formats, 0 lint errors and the same bytes twice; on the Drop Edition Strategy and Synthia speak in their own tiles on every word a tile of the call can hold (464 of 525 words; the other 61 fall in L1, on the full board or under the dub delay's four Synergys), never over Synergy, Pat or the board, and each of the 21 couplet drops keeps true black and the ignition on the plan's frames with its Y word on the board at the impact; the couplet's strike on the frame after it is drawn, on the film's own board grid (the frame's rect and safe span, at its board time), `strikeWeight` rows tall in signal across X in all three formats (2 rows in the 9:16 and 1:1 homes, 7 px pegs in the 1080 frame, so 3.5 px at 270 px wide; 1 row only where the 16:9 home falls back to PEG-3 for a long X; pegboard README); on the river no transport, camera or board move, scenes on bar lines growing and shrinking through split, G4, G6, G9, every tile easing in from no light on an "and" or a bar line with the clear phrases' sharp cuts the only hard ones, the speaker's tile at full, without effects and speaking on every word while the board shows it, Synergy at full on his words, 50 % or more of the footage slowed (all R1), the river look in the board's region on 95 % of the frames or more and the frame as dots at both ends, frame 0 and the last frame in one layout).

## Compositor

One WebGL2 canvas draws a frame of the frame program exactly, for the preview and for the export. The preview drives it from the All Hands engine's audio clock; the page at `/videostudio/` is the monitor.

| File | Role |
| --- | --- |
| `gl/compositor.js` | `createCompositor(canvas, {format, scale, post, preserveDrawingBuffer})`: `ready`, `prepare()`, `drawFrame()`, `read()`, `setFormat()`, `setScale()`. `governorGains()`, `boardTimeOf()`, `boardScreens()`, `FX_SUPPORT`. |
| `gl/shaders.js` | The uber layer shader, the chrome quads, copies and the post chain. |
| `gl/chrome.js` | The video call's chrome: the Canvas2D text and icon atlas, name bars, speaking border, toasts, banners, Pat's camera-off tile, the lady's tile. |
| `gl/board-layer.js` | The Peg Board inside the frame, drawn by `pegboard/renderer-gl.js` into the compositor's own context. |
| `media/element-pool.js` | The preview's `<video>` decoders: A/B pairs per slot, preroll, rate steering, `requestVideoFrameCallback` uploads. |
| `media/stutter-cache.js` | Exact frames as ImageBitmaps for stutters, holds and canon tiles, 25 MB at most. |
| `render/preview.js` | `createPreview()`: the clock, the pool, the compositor; play, pause, seek, scrub, step, re-layout. |
| `studio-film.js` | `studioFilm(plan, shots, {format})`: the first draft, built from the moves on the real shot index (`/videostudio/?cut=studio`; the monitor now opens on the track's own treatment, `treatments/index.js`, see Export). |
| `main.js`, `studio.css`, `/videostudio/index.html` | The monitor. Unlisted and noindex. |
| `scripts/check-compositor.mjs` | `npm run check:compositor`. |

### Drawing a frame

```
const comp = createCompositor(canvas, {format:'9:16', scale:1});
await comp.ready;                                  // the chrome's fonts (TT Hoves, Azeret Mono)
comp.prepare(program, {plan, shots});              // board screens, shot sizes, the governor's gain track
comp.drawFrame(program.frame(f), sources, {program, format?, gain?});   // returns stats
comp.read();                                       // {width, height, data}: RGBA, top row first
```

`sources(layer, i)` returns, for a video layer, `{image, key, version, width, height}` or `null`:

- `image`: any TexImageSource of the shot's picture: `<video>`, `ImageBitmap`, `VideoFrame`, a canvas. The 540p proxy and the master address the same source px, so either works.
- `key`: the GPU texture it uploads into (an element id, a cache slot). `version`: it uploads only when this changes (the pool passes rVFC's `presentedFrames` with the element's load count and frame); `undefined` uploads every time.
- `width`, `height`: the shot's source px (what `transform.matrix` maps to), not the image's. They default to the shot index given to `prepare()`.
- Or `{texture, flipY}` for a texture the caller owns. A Map keyed by `clipId` also works.

A video layer with no source draws as an empty tile (`#181a1e`). Generated layers need no source: the compositor never asks for Pat, the lady, the board or a colour.

`drawFrame` draws into the canvas; for the export, `new VideoFrame(canvas)` right after it. The canvas is `format × scale` pixels (1080×1920 at scale 1). The canvas keeps nothing from one frame to the next: frame f depends only on the frame, its sources and f.

### Bottom to top

1. The call's background, `#101114`.
2. The Peg Board in the layout's region (`frame.board.rect`, 12 px corners), opaque, when no tile covers that region. Board cues with `z:'under'` in their cells.
3. Each layer in draw order: its echo copies, the layer, Synergy's mouth row (below), then its chrome. Then psych cells (`frame.board.psych` entries with a `rect`): each its own opaque peg board over its tile, its footage sampled from what is drawn so far.
4. The board over the picture (and over a psych cell that covers its region, with its own panel). Psych imagery without a cell is painted into the board's own grid, under its words, wherever this step or step 2 draws it. L1's panel (`board.over`) is the whole board, sockets included, whether or not a screen is up, so it never comes and goes. Over a full-frame picture only its light shows (MAX blend, no sockets, `board.panel` 0), at the peg video's pitch when there is one. Over generated tiles (black, Pat, colour), the whole board shows, sockets included. A moving board (`board.move`) is laid over the picture, its panel fading in by `board.panel` (light first, then the panel at that opacity). Board cues with `z:'over'`. The screen-share banner in the layout's banner rect (BOARD+STRIP).
5. Droste: level k copies the frame and puts level k−1 into the feedback tile (the whole frame at `scale`, centred on `cx, cy`), in two ping-pong framebuffers; a fractional depth fades the last level in. Level 0 is the frame itself, with Pat's camera-off card in the tile. The frame's own composite stands in for "the previous output frame", so every frame is seek-safe.
6. The composite camera: `frame.camera.matrix` and its effects over the whole frame. A camera that does not own the board (`camera.board` false, the default) left steps 2 and 4's main region out; it is drawn now, fixed, over the moved picture (`stats.fixedBoard`).
7. Post: a bloom (bright pass at half size, dual-Kawase down and up), the governor's gain, grain weighted to the mid-tones and seeded by the frame number, ±0.5 LSB triangular dither. `POST` holds the defaults; `post:{bloom:{weight:0}, grain:0, dither:false}` turns them off.

### Synergy's mouth row

The meeting room's `drawRobotMouth` (`src/meeting-room/Participant.jsx`), drawn by the compositor so the preview and the export carry it the same way: 22 green bars, 3.2 × 6 units, 4.3 apart from x −46, at `layer.robot.mouth` (the tracked point through the layer's matrix, his roughly 4.4° tilt plus the layer's rotation), `rgba(74, 255, 112, strength)` with the canvas's 2 px shadow (a Gaussian of 1 source px). `strength = level > .08 ? max(.16, (1 − d/7) · level) : .11`, `d = (phase − i) mod 22`, `phase = (song time · 15) mod 22`: speech runs a bright wave along the row, rest is a .11 glow. One instanced draw (`MOUTH_VS/FS`) right after his layer, masked by its cell, iris and opacity and coloured by its saturation, so it zooms and fades with his face; G11 refuses warps and mirrors on him and anything over the row. It is green because it is his face, not type. Against the meeting room's own code drawn on the same plate at one output px per source px it measures 54.7 dB sung and 58.5 dB at rest (`check-compositor` 5b).

### The layer shader

Output px go through `transform.matrix` (transposed for GLSL) to source px, then divided by the shot's size for UVs. Outside the picture a layer is transparent. The cell's rounded-rect SDF (`radius`, antialiased over one device pixel) masks it, then the iris, then `opacity`.

| fx | What it does |
| --- | --- |
| `tile` | `cols × rows` copies of the cell, alternate ones mirrored when `mirror` is 1. |
| `fold` | `x`: the right half mirrors the left; `y`: the bottom mirrors the top; `xy`: both. |
| `mosaic` | Blocks of `px` output px from the cell origin, each one colour. |
| `scanline` | `wobble`: each line pair shifts sideways, seeded by the line and the frame. `amount`: the second half of each `period` darkens. |
| `zoomBlur`, `dirBlur` | 16 taps toward the centre, or along `angle` over `px`. |
| `rgbSplit` | Red moves `+px` along `angle`, blue `−px`, green stays. Applied to every blur tap. |
| `saturation`, `chromaDrop` | Mix toward Rec. 709 luma. |
| `pegVideo` | Luma^`gamma` in `levels` blue steps, one peg every `pitch` px on the cell's grid. A dark peg leaves its socket showing. |
| `iris` | A soft circle of `r` × the half-diagonal. |
| `droste` | The pass in step 5. |
| `echo` | `taps` copies at the transforms of frames f − k·`frames`, opacity `decay`^k, under the layer. |
| `breathe` | Two samples per pixel: the block centres of the 2^n and 2^(n+1) px grids from (cx, cy), crossfaded by smoothstep(fract(log2 px)). |
| `paletteWash` | `l + tint(hue)·(1.1 − .6 l)·k(l)`, `k` 0 at black and white, clamped; mixed with the picture by `mix`. Not applied to Synergy's mouth row. |
| `trail` | The copies are layers of the program (`layer.trail`), drawn right after their clip and before its chrome, MAX-blended for lighten (premultiplied, so a dim copy only shows where it is brighter). |
| `radialFold` | Polar about (cx, cy): the angle folded into one wedge, alternate wedges mirrored, the radius kept, then reflected into the cell. |
| `pegBloom` | Per peg cell: nearer than the front, a peg (the peg video term at full mix); inside the band, one colour per peg cell; beyond, the footage. |
| `chromaDrift` | Folded into each sampling tap with `rgbSplit`: red, green and blue each read at their own offset. |

The order inside the shader is: tile, fold, radial fold, mosaic and wobble (cell space, the breathing mosaic sampling through them), then the matrix, then blur with split and drift, then colour (the palette wash last), then scanline darkening, then peg video and the peg bloom, then the masks. Two effects of one type in one layer: saturations multiply, otherwise the last one wins.

### Chrome

The site's meeting room (`src/meeting-room/meeting-room.css`), at film scale, with no third-party call marks. `chromeScale(cell)` sizes it to the tile: 1.0 for a G9 tile, up to 1.2.

- **Name bar:** a strip along the tile's foot (`#15171b`, 92 %): the mic or muted icon, the name, `· role` (the meeting room's cast roles when the clip names none; the host's is never shown), and speaking dots.
- **Speaking border:** the meeting room's green `#7cdb65`, 5 px inside the tile's corners, its opacity the clip's `speaking` (bind it to a stem). Type is never green; only the border, the mic and the dots are.
- **Toasts:** a pill at the tile's top, in over 0.18 s and out over 0.18 s: user-plus for "joined", log-out for "left the meeting".
- **Banners:** a pill at the tile's top left, or the layout's banner rect in BOARD+STRIP. A screen-share icon in blue, or a wifi-off icon in signal yellow for a bad connection.
- **Pat** (`gen:camera-off`): the meeting room's radial camera-off tile, the "PT" avatar, the name, "Camera off", the camera-off icon. Never footage.
- **The lady** (`gen:camera-off` whose name is the lady or Circle Back): no avatar and no face, ever. Her voice is a waveform of 23 bars driven by `speaking`.
- The name bar moves to the tile's top when it would cover Synergy's tracked mouth row (`layer.robot.mouth`).
- **Legible on a phone** (`LEGIBLE`): names never under 11 pt and roles never under 9 pt on a 390 pt phone held upright (9:16 and 1:1: 30.5 and 24.9 px of 1080), or across an 844 pt phone held sideways (16:9: 25.0 and 20.5 px of 1920). The name bar grows with the name; toasts, banners and Pat's card read at the name's size. Where a tile cannot hold the role beside the name the role goes, then the mic icon, then the speaking dots; the name never does.

Text and icons (lucide paths) are rasterised once at device size into a 2048² Canvas2D atlas and drawn as instanced quads, clipped to the tile's rounded rect.

### The board

`gl/board-layer.js` gives each board region (the layout's strip, the whole frame, a `gen:board` tile, a cue's cell) its own grid at `pitchFor(w, h)`, or at the peg video's pitch when it lies over one. It paints it with `choreo.paint()` and draws it with the Peg Board's own WebGL2 renderer into a texture of the compositor's context. `renderer-gl.js` takes `{gl, output}` for that and nothing else changes. Up to 6 regions (the home, cue cells, psych cells) stay allocated; a moving board (a new size every frame) draws through one more instance that is resized, never recompiled.

Pegs are hits: an onset at song time t lights on `floor((t + L)·24)`, the frame that holds its sound (`frame.board.lead` is `L`, 16.33 ms). choreo paints the middle of a frame: it lights a unit half a frame before its onset but switches a screen on at its exact start. So frame f paints at `f/24 + 1/48 − L` (`boardTimeOf`) with every screen moved half a frame early (`boardScreens`), and `compile` picks each frame's screen by the same rule (`activeScreen`). A rung marked `under` (her ladder under the couplet drop's "IT'S NOT X.") does not end the line over it when compile trims each screen at the next: the line holds the board while it is sung and struck, and the rung shows once it lets go, as on `/allhands/`'s stage (before Nov 5 the film cut the drop's X at the first rung under it and never showed its strike). The choke follows her voice, on every track and cast: her tag's screen holds and its typewriter finishes its last letter on the last frame she is heard in; the board goes true black (sockets off) on the first frame that starts after `plan.choke.tagEnd + CHOKE_TAIL + L` (choreo `darkAt`, anchors `chokeFrames`). `CHOKE_TAIL` is 30 ms, codec-aware (choreo `CODEC_FLOOR`): the choke cuts her tag hard, and the Opus encoder leaves a hiss floor at -66 to -70 dBFS for about 25 ms after a hard cut whatever its frame size, which an AAC copy made from it carries too; the longest floor plus 5 ms keeps every sample above -70 dBFS off black in the file (Humbled and Honored's tag, floor included, last sounds at 36.167 s; black from 36.208 s). The endings keep `TAG_TAIL`, 5 ms (her "Full stop." is not cut against black). Black from Circle Back frame 952, Humbled and Honored 869, Hustle 879, Offsite 792 with today's cast: 7 or 8 black frames before the impact on every track, the sample and every fixture post with its own cast (`check-review-video` 1a) and holds it to the impact's frame, where it ignites for exactly one frame (`igniteAt`: Circle Back 960, Humbled and Honored 876, Hustle 886). A Drop's kick lift on the board is a hit too.

Psych imagery (`frame.board.psych`, Psych cues above) is painted into a region's grid after its screens (`board-layer.js paintGrid`), so it shares the board's pitch, sockets and bloom; a psych cell draws its own region over its tile.

Type stays inside the format's platform-safe area on both axes: each region's grid lays its words out only in the columns the safe area leaves it (`boardGrid(w, h, pitch, safe)`, `safeSpan`), so in 9:16 the words keep left of the right rail at x 944 and centre on the safe span, not the strip. Lit pegs of a reveal or the ignition still run edge to edge.

### The governor

`prepare()` predicts each frame's relative luminance, whole and per quadrant, on a 9 × 16 grid. The top layer at each point gives its luma: footage reads the shot's `lumaTrack` at the layer's source frame; generated tiles and the board are exact. The Peg Board's `governorTrack()` turns that into a gain per frame, so there are never more than 3 flashes a second (rule G6). It takes about 260 ms for 1,440 frames. Pass `{governor:false}` to skip it (the metronome export), or `drawFrame(..., {gain})` to override it.

### The preview

```
const pv = createPreview({canvas, program, plan, shots, song:{buffers, lady}, scale, avOffset});
await pv.ready;
pv.play(); pv.pause(); pv.toggle(); pv.seek(s); pv.scrub(s); pv.endScrub(); pv.step(±n);
pv.setProgram(program);                 // another format: the same moment, re-laid out
pv.setSong(plan, song, program);        // the voice arrived: the same moment in the new plan
pv.on(({f, t, playing, stats, pool, cache}) => ...);
```

- **Clock:** `f = floor((position() + avOffset)·24)`. `StudioPerformance` is the engine's `Performance` able to start on any 16th, with the call's band-pass state set as if the song had played from the top. A seek restarts the sound on the 16th that holds it. A scrub moves the picture and the sound waits for the release.
- **Measuring the band:** once the voice is in, the monitor renders the song offline with `songFeatures()` (`render/export.js`: the export's own `engine.render` with the stems and `buildFeatures`), recompiles and swaps the program in at the same moment; the status reads MEASURING THE BAND until then. The Download MP4 hands those same features to `exportFilm`, so the monitor and the file draw one program (same hash). Two renders give identical features here. At 10 frames the preview and the export's picture path agree: 2 identical, the rest 45.3-66.0 dB (the two decoders differ in the last bits).
- **Element pool:** 8 slots on a desktop, 4 on a phone, each an A/B pair of `<video>` elements. The front plays its stream; the back prerolls the stream its slot plays next, one beat early (`program.decode.prefetch`). A playing element runs at the clip's rate, nudged by up to ±3 % toward the program's source time. It seeks only past 2 frames of error.
  - Freezes, stills, tape-stepped and out-of-range rates pause the element and seek frame-exactly to `proxyTime`. Reverse plays the reversed proxy forwards.
  - No reversed proxy (none recorded, a 404 on load, or `reversed:false`): the reversed stream's element loads the forward file and never plays. It seeks to the forward frames the next 2 to 8 output frames show (half the stutter cache at most), soonest first, and captures each as an ImageBitmap under the reversed proxy's own key (frame N − 1 − forward frame), capped at 540 lines so a master costs no more than a proxy. `source()` serves only captured frames (the exact one, else the nearest within two), so a late capture holds, never blanks. Against the reversed proxy: 40.5-44.4 dB on every tested frame (the two files are separate CRF 20 encodes); against the export's own decode: 86-88 dB.
  - The pool uploads only when rVFC reports a new frame. `settled(f)` is true when every stream of frame f shows its exact proxy frame.
- **Stutter cache:** frames the program will need again (stutters, holds, a stream shown in two tiles) are captured as ImageBitmaps as they pass, 25 MB at most, oldest first out.

### The monitor

`/videostudio/` (noindex): the track's own treatment on the audio clock (`treatments/index.js`: Offsite is cut with `offsite-psych`, every other track with the drop60 draft), for any track of the song book and any post. The spec line under the picture names the treatment; the cut list shows its scene labels.

- A format toggle: 9:16, 1:1 and 16:9, each re-laid out and recompiled.
- Play and pause, a scrub bar in bars with the song's sections, the scenes as a cut list (click to jump), and every cut. Labels never truncate or collide: a name sits in its span when it fits, else its written short form (Share, Dub, Rooms, Lag), else it moves to a callout lane (sections above their row, scenes in two lanes under the blocks) on a hairline to its span.
- Readouts: bar:step, frame, time, section, layout, scene. The layers on screen, and the lint (click a finding to see its frame).
- Keys: Space, ←/→ (frame), Shift+←/→ (beat), 1/2/3 (format), Home.
- Song: Circle Back, Humbled and Honored or Hustle by hand (today's lines for the lady), or Let the post choose (on by default: casting.js `castSong` picks the track and her lines and `settleCast` places them, as /allhands/ does). The sample post, or paste one and Cut this post. A new song recompiles the film at the top; the voice, the lady and the band's measurements follow it.
- The film always opens cold (`coldOpen:true`, sound and picture): the preview cuts the cold open's sound from the track's own render (engine.js `prepareColdOpen`) and plays it in front of the song whenever it starts inside the first second.
- Query: `?format=16:9`, `?scale=.5`, `?av=-20` (ms), `?f=960` (open on a frame) and `?track=hustle` (by hand).

The page opens on a provisional plan, then re-arranges on Synergy's measured words once they load; a new track or post does the same from the top (a stale load is dropped).

### Checks

`npm run check:compositor` (95 checks, about 110 s on a quiet machine, 800 s under load; `--out DIR` for the frames, `--quick`) runs Node, then headless Chromium on SwiftShader WebGL2:

- the draft cut compiles clean in all three formats, and Pat and the lady are never footage
- peg onsets land on the frame that holds their sound, `floor((t + L)·24)`
- cell edges, gutters and rounded corners, by pixel probes
- every effect changes pixels the way the table says
- the psychedelic pixelation (4c): the breathing mosaic's blocks from the cell centre and its octave crossfade; the palette wash keeps luma, turns blue, violet or warm and leaves no green pixel; the radial fold's 60 degree symmetry; pegs blooming from the centre with the corners still footage; the chroma drift's offsets; a trail only brightening where a tile has been. Then two seconds of the Offsite cut's clap circle on real proxies: at most 3 flashes in any second, whole frame and quadrants, with and without the governor; Synergy's tile identical with and without the effects around him; his mouth row green under his wash
- the chrome
- the board in its strip, a tile, over the frame, at true black and at the ignition
- psych imagery (6c): a mandala under the words in the home with the words still the brightest; ripples on their own tile; footage through the grid (the card's greens become blue pegs, no green pixel); a full-frame psych tile with the home over it; true black at the choke with a cue live; the same pixels twice; no more governing than without it
- Synergy's mouth row against the meeting room's `drawRobotMouth` (sung, at rest, half level), and on real footage in the draft: lit on a sung word, glowing at rest
- texImage2D on the same-origin forward and reversed proxies (frame N−1−k against frame k)
- reversed footage with no reversed proxy (switched off, or a 404): the export decoder's frames match the reversed proxy's at ≥ 38 dB and beat their neighbours by > 3 dB; the preview's captured frames likewise; a 1080p GOP-120 master with B-frames decodes forward and reversed through a 40 MB cache
- the stutter cache budget and the pool's exact frames
- identical SHA-256 across two fresh pages, for synthetic frames and for the draft cut on real proxies
- SwiftShader timings, for information only

### Not yet

- A seek-safe Droste uses the current frame for "the previous output frame"; true frame-to-frame feedback (datamosh) is not built.
- `echo` copies follow the transform only (the current source frame at earlier positions); `trail` is the one that shows earlier source frames.
- Chrome is not masked by the iris, and it zooms with the camera (it is part of the call).
- The department chart (OUTPUT BY DEPARTMENT) is not drawn in the film's boards.
- Context loss is not handled (the board's 2D fallback does not apply inside the compositor).

## Export

The film to an MP4, offline and frame-exact, from the same frame program the monitor plays. The same EDL, plan, shots and song give the same samples, the same frames and the same bytes.

| File | Role |
| --- | --- |
| `render/export.js` | `exportFilm()`, `exportSupport()`, `captions()`, `master48k()`, `planJSON()`, `sha256()`, `exportName()`; `VIDEO`, `AUDIO`. |
| `media/decoder.js` | `demux()` (ISO BMFF sample tables), `createFrameDecoder()` (WebCodecs `VideoDecoder`, GOP at a time, a cache sized by the program), `layerStream()`, `frameLedger()`. |
| `treatments/drop60-draft.js` | `drop60Draft(plan, shots, {format, notes?})`: plan §2 as an EDL treatment, the cut of every Drop Edition track on `/videostudio/` and in the export, for any post: every passage hangs off the plan's landmarks (sections, the unmute, Synergy's lines, the ladder rung by rung by its retrigger rate, the choke, the impact, the bend, Sink In, the tape stop, `plan.coldOpen`), never Circle Back's bars; the band's parts (`plan.band`) through `bandSpeakers` (below), a couplet drop's lead-in and Y word on the choke and the impact. 0 lint errors on all three tracks in all three formats, today's cast and the post's. `ROWS` (row by row: done, stand-in, partial, skipped), `CAST`, `SCENE_LABELS`. `notes` (an array) collects the band parts no tile could hold. |
| `treatments/offsite-psych.js` | `offsitePsych(plan, shots, {format, notes?})`: Offsite's cut. A river plan (`plan.form === 'wander'`, Offsite's own since Nov 5) is cut as the river (below, "The river"); a Drop Edition plan keeps the psychedelic pixelation (below), on every track. `CAST`, `SCENE_LABELS`, `RIVER`, `RIVER_CLASSES`, `RIVER_LANES`. 0 lint errors on every track in all three formats. |
| `treatments/shared.js` | What every Drop Edition treatment shares: `landmarks()`, `coldOpen()` (the jump, the rewind, the board home on the intro's first frame, the rewind's wobble) and `ending()` (the tape stop, Synergy's eyes open, true black, the ghost BACK.). drop60-draft carries the same steps inline. And the band on screen for any treatment: `bandSpeakers(edl, plan, shots, {format, seed})`, `speakingKeys(words, t0)`, `VOICE_SHOTS`, `VOICE_NAMES`. |
| `treatments/index.js` | `TREATMENTS`, `BY_TRACK`, `treatmentFor(track)`, `treatmentNamed(name, track)`: which treatment cuts which track, on the monitor and in the export. |
| `scripts/export-videostudio.mjs` | `npm run export:videostudio -- --format 9:16`: the page's Download MP4 in headless Chromium, to a file. |
| `scripts/check-videostudio-export.mjs` | `npm run check:export`: the P3 gates on real exported files. |

### Treatments

A treatment is a pure function `(plan, shots, {format, features?, seed?}) -> EDL` that hangs every passage off the plan's own landmarks (sections, the unmute, Synergy's lines, her ladder rung by rung, the claps, the choke, the impact, Sink In, the tape stop, `plan.coldOpen`), so it cuts any track and any post. `treatments/index.js` picks one per track:

| Track | Treatment |
| --- | --- |
| Circle Back, Humbled and Honored, Hustle | `drop60-draft` (plan §2, the signed-off films) |
| Offsite | `offsite-psych` (the river, its own form; a Drop Edition plan of Offsite gets the psychedelic cut) |

**Adding one:** write `treatments/<id>.js` exporting the function and `SCENE_LABELS` (a label for every `scene` its clips carry); build the cold open and the ending from `shared.js` so the loop seam, the choke and the ghost hold; register it in `TREATMENTS` and name the tracks it cuts in `BY_TRACK`. Then `check-videostudio` 13 and `check-review-video` 1 run it on every track and format (0 lint errors, the same bytes twice, canon on every frame, Synergy's mouth row, the ending and the ghost, no partial words), and the monitor and `export-videostudio.mjs --edl track` pick it up.

**Offsite (`offsite-psych`).** Aaron: "lets get more of a panda bear style song... this means the video may be a bit more psychedelic pixelation." Cut for voices and claps, not bass drops: the mosaics breathe with the voices (`breathe` bound to `voices` and `clap`), the footage washes into Peg Board duotones drifting blue, violet, warm across the film (`paletteWash`, one hue curve for the whole song), trails smear motion on the backbeat (`trail`, its decay bound to `clap`), mirrorable close-ups fold into kaleidoscopes (`radialFold`, never Synergy, a robot or an instrument), the footage turns into pegs that bloom out of the board's home (`pegBloom` centred on the home, in frame units), and the colour drifts (`chromaDrift`). Synergy's face takes only a light wash; no warp ever reaches his tile.

Then, with the steady loop (Aaron: "a little more slow motion - and less of the downbeat... if we can use the DOT grid for psychedelic images, even better"), it flows like the groove:

- **Slow motion.** The call's R1 footage (listeners, idles, the walk-in, banners, the slow glass, `CAST.still`) runs at half speed, slower (.35) under her slowed round, each new shot entering at speed and easing into it over a beat (`time.rate` keys). Synergy and the drops run at speed and follow the song wherever it slows (`slowOf(plan)` in `songbook/offsite.js`: the slow tape under the second verse, the hook and the sign-off, the room starting to sink), easing over an 8th; Sink In is tape-coupled as before. R0 plates hold their frame where the song slows; the printer keeps its tempo; instruments never play here. About two thirds of the footage on screen (by area) is slowed, all of it R1 (`check-videostudio` 13). The closing close-up runs at half speed through the tape stop (`shared.js ending()` keeps his eyes open at a constant rate).
- **Fewer hard cuts.** Inside a scene a tile changes only on an "and" (the clap's hands, every six beats in the verse, every two beats in the drop from its second bar) and dissolves in over an 8th on top of the shot it replaces. Between two call layouts every tile but Synergy's and Pat's dissolves across the bar line (the outgoing shot plays on an 8th and fades out under the incoming one); Synergy cuts, because nothing may lie over his mouth row and he is fully up whenever he sings. Not into Sink In (eight decodes at once) or into and out of L1 (its panel lies over the picture, G14): the Drop B mandala comes in as the melt's 44 px blocks and resolves over two beats instead. Drop B's bloom comes out of the pinwheel's pegs (its tiles start as pegs and clear over an 8th). In 9:16 the frames where half the picture or more cuts at once fall from 13 on the downbeat to 7 (the fold, under the rings at full; the spiral; Sink In; the mandala, as blocks; the bloom, out of pegs; the outro's split and close, where Synergy enters singing); the 11 cuts on the claps (4 listeners in the verse, 5 in Drop A, 2 in the mandala) are gone, and 1 cut off the downbeat is left (the call back after the ignition).
- **The dot grid** (psych cues, above), cross-faded with the footage effects: a look in the board's region under the words on 89 % of the frames (ripples from the intro, a low moiré under the verse, mandalas under the hook, a spiral from the fold that grows to the frame with the board for the 32nds, the BACK. bloom as a 12-fold mandala on the impact's full board that settles home with it, a slow plasma as the room sinks, ripples under the bloom, lissajous figures under the outro, brightest between the sign-off and "Full stop."); full-frame looks between lines with Synergy off screen (rings born on every beat from the home's centre as her slow rungs' peg bloom completes, dissolving into the fold; a pinwheel in Drop B between his verse and the hook); looks in single tiles (the crew walking in as footage through the grid, the printer for the second half of the verse, two mandalas in the hook's round, a spiral in the build, two footage tiles in the fill). A cell's cue ends half a frame before the frame that cuts at its last step, so it never outlives its tile.

| Scene | Layout | What happens |
| --- | --- | --- |
| Arrivals | split | The crew walks in at half speed, first through the dot grid, then pixelated, resolving as the call connects (28 to 2 px); Pat's black tile; ripples in the home |
| The call | G4 | Synergy joins on the unmute with his welcome; the crew and the printer dissolve across (the printer is one take in tempo into the verse, in the same tile) |
| The circle | G6 | The verse: Synergy (slowing with the second verse's tape), a slow listener dissolving in on the "and" every six beats, a slow kaleidoscope pair; the printer through the dot grid for the second half |
| Choir of glass | G9 | The hook on its slow tape: a half-speed round of kaleidoscopes, each a step later than the last, around Synergy; two of its corners turn to mandalas of pegs |
| Drift | G6 | A second verse, when the track has one |
| Pegs rise | G4 | Her slow rungs, slower than half speed: pegs bloom out of the board home a step on each retrigger, then the frame becomes rings of pegs born on every beat |
| Fold | L1 | Her quarter notes: one slow kaleidoscope gains wedges on each retrigger, dissolving in from the rings, always at 9 px blocks or more |
| Spiral | G6 | Her 8ths and 16ths at speed: the kaleidoscopes turn a notch on each hit; Synergy's tile lights on his stammers; a spiral of pegs in one tile and in the home |
| The board alone | full | Her 32nds over the spiral, grown to the frame; the choke; true black |
| Clap circle | full, G6 | The ignition with the BACK. bloom as a mandala; then every two beats on the "and" a tile dissolves to a new face; at speed until the room starts to sink, then the faces ease into half speed and the glass holds |
| Melt | G4 | Sink In: the tape slows the picture, on "in" it holds and melts to 44 px blocks; a slow plasma in the home |
| Mandala | L1 | Drop B's first two bars: a slow full-frame kaleidoscope, its wedges stepping on the claps, coming in as the melt's blocks; a second glass on the "and"; a pinwheel of pegs takes the frame between his lines |
| Bloom | G9 | A slow call; pegs bloom out of the board home on the claps; Synergy sings in the middle; the fill: one slow picture in canon round the circle, dissolving in on the "and" of four, two tiles through the dot grid |
| Leave the offsite | G4, split, L1 | Each one turns to pegs and leaves ("left the offsite"), the one who stays dissolving into the split; Synergy alone at half speed; the tape stop |

**The band on screen (`shared.js bandSpeakers`, Nov 5).** Synergy sings the post; Strategy and Synthia sing the lexicon where his other repeats were (`plan.band`, allhands/band.js). Their tiles speak: for each of their parts the singer is laid over a tile of the call (z 2, opaque, so the tile under it costs no decode) from a frame before the frame that holds the first word (a vocal cut) to a quarter second after the last, `chrome.speaking` keyed on the words (`speakingKeys`, seconds from the clip's start, runs joined across gaps under 0.2 s). The host is the cell that stays on screen longest: theirs when the call already shows them (Strategy thaws to speak in the frozen call), else a listener's, else an instrument's; never Synergy's, Pat's, the board's, a full-frame picture or L1, and only where a take holds the cell under the upscale ceiling (`VOICE_SHOTS`: strategy-speaking first; synthia-clean-face-plate). Where the call re-lays out under a part the singer moves with it, one segment per layout (each a quarter second or more); the caller of an exchange and a couplet's X stay up through the answer when one run of tiles holds both. A segment the lint refuses is dropped and noted, including one that covers Synergy's mouth row as a whip slides him under it (G11 names the whip; the tile is read from the message: Circle Back 16:9, 6 of 61 posts). On the sample and the 12 casting picks (36 films) 464 of their 525 sung words land in their own speaking tiles; the other 61 fall where no tile of the call can hold one (L1's kaleido, the full board, the dub delay's four Synergys, 16:9's narrow stack3 for a 720p take), and the board carries those alone. The lady's parts are the board's; she never has a face.

**The couplet drop.** When the post's drop is a couplet (`plan.drop.kind === 'couplet'`), Strategy's "It's not X." plays over the build (his tile speaks in the rooms), the tag on the choke is the couplet's lead-in ("IT'S IN-", Synthia) and the impact its Y word ("DEMAND.", or her word when she owns it). The cut needs nothing new there: the choke's black and the ignition stay on the plan's frames (`chokeFrames`), the board shows the words, and the cold open and the loop seam's ghost show frame 0's impact, the Y word (21 couplet drops checked, `check-videostudio` 15).

### The river (`offsite-psych`, `plan.form === 'wander'`, Nov 5)

Aaron: "a natural river of electronic sound": repeating samples building into a texture, layers ramping in, a flow that gently changes, very few clear vocal phrases. The picture flows the same way. There is no ladder, choke, impact or tape stop, so no cold open, no ignition, no board move and no transport: the cut is built from the plan's own fields.

- **Lanes.** Each voice of the texture is a tile, following its layers (`plan.layers`, the level each layer's gain curve gives, `pegboard/psych.js layerGain`): the loop of hands and the office (the room: the crew arriving, People & Culture typing, the banner crew, the printer), the drone (a slow kaleidoscope of a mirrorable close-up), the bass (Pat's card, its border on the bass stem: he hums the root), Strategy's word and "It's not X." looped (Strategy listening, then speaking), the acoustic colours (two listeners), her syllables (her waveform on a camera-off card named Circle Back, bottom row only). A tile eases in from black over its layer's ramp (a beat at least) as pegs resolving into footage (`pegBloom` from .85) and through a dot-grid bloom (a `footage` psych cue on its cell), and eases out over its ramp out.
- **The layout grows with the river.** Per bar, the layers sounding (gain over .3) pick the class: 3 or fewer split, 7 or fewer G4, 11 or fewer G6, more G9, one class smaller where the river slows (`plan.slow`). Runs under two bars join their neighbour; no re-layout under Synergy (his tile's whole window) or a clear phrase (its first bar to two beats after its last word). The sample: split 0-3, G4 3-9, G6 9-14, G9 14-20, G6 20-26 (the pool), split 26-27; the plan's sections name the scenes (Source, Stream, Current, Swell, Pool, Delta). A re-layout is a 12-step dissolve (`RIVER.relayout`, three beats): each lane carries on into the new layout's tile from the outgoing tile's shot and source time (one decode), the incoming one fading in on top while the outgoing one plays on under it and fades.
- **Repeating samples.** A tile's next shot dissolves in over a beat (`RIVER.change`) on an "and", three bars on, staggered tile by tile so the call changes one tile at a time; no two tiles show the same shot at once, save the canon copies: a tile a scene leaves empty carries a copy of the glass or the room, two or three steps behind and at .72 light, within the stutter cache's 12 frames of its source (one decode).
- **Slow motion.** R1 footage at half speed, .3 in the slow spans (eased over a beat); R0 plates at speed, holding their frame where the river slows; no instrument plays; Synergy at speed. 79-83 % of the footage on screen (by area) is slowed (the sample and the three picks, all formats).
- **The stream's look.** Mosaics that breathe with the voices and the claps and grow with the smear layer, echo trails (3 copies) whose decay rises with her copies, a chromatic shimmer with the tambourine, pegs blooming out of the board's home in the swells (`plan.swells`), the palette wash's hue following the colours' pitch window (`plan.drifts`: blue low, violet, warm at the top), kaleidoscopes turning slowly on the glass.
- **The dot grid.** One river look in the board's region all film long, the look and its light the stage's (`riverTrack(plan)`: its level keyed every beat from `riverAt`, half speed in the slow spans), on 1439 of 1440 frames; the whole frame as dots (a `full` cell) while her syllables play alone at the start and as the river lets go at the end; each tile born through the grid.
- **The clear phrases** (`plan.band`, at most two) are the only sharp moments. The speaker's tile (Strategy, Synthia, or her waveform: never a face) is laid over a top tile from a bar before the phrase, soft; it cuts sharp a frame before the frame that holds the first word, at speed and without effects, its border lit on the words, while the board's type lands; on the first "and" half a beat after the last word it sinks back in (the stream's look dissolving over two beats, slowing to half speed) and fades with its echo layer. Synergy sings his hook once, washed (a .2 wash, nothing else), laid over a top tile at full from a beat before his first word to a beat after his last.
- **The loop seam.** Frame 0 and the last frame are both the split, black under the home's dim river look.

| Scene | Layout (sample) | What happens |
| --- | --- | --- |
| Source | split, bars 0-3 | Her syllables alone: the frame as dots; the room and the glass fade in through the grid as the loop and the drone ramp |
| Stream | G4, 3-9 | Pat's card with the bass, a listener with the plucks; Synergy laid over the room for his hook, then gone |
| Current | G6, 9-14 | Strategy's word comes in (his tile, trails), the second listener, her waveform, copies of the glass |
| Swell | G9, 14-20 | The fullest call, pegs blooming from the home; Synthia's tile cuts sharp on "IT'S IN DEMAND." |
| Pool | G6, 20-26 | Half speed and slower; the refrain's speaker sharp on the words (her waveform on the sample), the frame turning to dots |
| Delta | split, 26-27 | The last tiles fade with their layers into black |

### Calling it

```
const out = await exportFilm({edl, plan, shots, song:{buffers, lady}, format, scale:1, master:false, span:[from, to],
                              audio:'render', governor:true, onProgress, signal});
out.mp4      Uint8Array          out.vtt   captions.vtt          out.sidecar   the JSON sidecar
out.program  the program it drew out.pcm   the 48 kHz master it encoded
```

1. **Sound.** `engine.render(plan, buffers, {tune:{stems:true}}, lady)`: master on channels 0-1, the six stems on 2-7. For a span only the bars it needs are rendered, with a bar of run-up. The master is resampled to 48 kHz by the browser's sinc resampler (`decodeAudioData` of a float WAV) and cut so sample 0 of the file is song time `from / 24`: exactly 2,000 samples a frame.
2. **Features.** `buildFeatures(plan, render)` (stem levels, the kick, `eqTrack`), then `compile()` again with them, so every bound parameter (speaking borders, binds) follows the real mix. Lint errors block the export; `force:true` exports a draft anyway.
3. **Picture.** For f = from…to−1: `decoder.prepare(f)` decodes exactly the source frames the frame shows; `drawFrame()`; `new VideoFrame(canvas, {timestamp:(f − from)/24 s})`; `encode()`; close. `encodeQueueSize` above 2 waits on `dequeue`. A keyframe every 48 frames.
4. **File.** `mp4-muxer`, moov first (`fastStart:'in-memory'`), video timescale 24 (one tick a frame, CFR), audio timescale 48,000.

| | |
| --- | --- |
| Video | H.264 High `avc1.640028`, 1080×1920, 1080×1080 or 1920×1080 (`scale` for proxies of the size), 24 fps CFR, 8 Mbps VBR, 24 Mbps with `master:true` |
| Sound | AAC-LC `mp4a.40.2` 48 kHz stereo 256k where `AudioEncoder` has it, else Opus 48 kHz 256k in the MP4 (`exportSupport()` says which; the page says so). Headless Chromium has no AAC encoder. Opus pre-skip (312 samples) is in the `dOps` box, so decoders line the sound up with the picture. |
| Captions | `captions(plan)`: WebVTT, `<v Synergy>` for every sung line and `<v Circle Back>` for her phrases, timed by the plan; a retriggered phrase is one cue. Sentence case, no em dashes. |
| Sidecar | `{kind, film:{form, track, format, width, height, span, frames, seconds, planDuration}, video, audio:{codec, fallback, preSkip}, hashes:{edl (sha256 of the canonical EDL), plan (sha256 of planJSON), program (compile's FNV-64), mp4}, lint, stats:{seconds, msPerFrame, split, decoder, frames (the ledger), memory}, edl}` |

`onProgress({phase:'audio'|'sound'|'picture'|'finishing'|'done', frame, frames, fraction, msPerFrame, eta, elapsed})`. `signal` (an `AbortController`'s) cancels between frames; everything is closed on the way out.

### The decoder

- `layerStream(layer, shot)`: a forward layer reads the 540p proxy at `srcFrame`; a reversed one reads the reversed proxy at `proxyFrame`; without a proxy, the master at `srcFrame`.
- **No reversed proxy** (a 404, or `reversed:false` on the decoder and `exportFilm`): the stream loads the forward proxy (or the master) instead and numbers its frames backwards, k = N − 1 − forward frame, so every key and cache entry is unchanged and the reversed order is exact. Decoding still runs forward, a GOP at a time; the cache serves the frames backwards.
- **Masters**: a GOP run stops at the last frame the program still wants (plus the file's reorder depth), not at the next keyframe, so a long-GOP master does not decode seconds it will not show. Past `budget`, the entries used furthest ahead are dropped (Belady) instead of failing; only a frame that alone exceeds the budget throws.
- Proxies are GOP 12 with no B-frames: a missing frame decodes its whole GOP (12 chunks, then `flush()`), and every output `VideoFrame` is copied out (`copyTo`, I420 at 540p is 0.78 MB) and closed inside the output callback. `source(layer)` wraps the copy in a fresh `VideoFrame` for `drawFrame`; `release(f)` closes it after the draw.
- The cache is sized by the program: every frame's keys (stream, proxy frame) are known before the first decode, so an entry stays only while its next use is within `horizon` output frames (24, two beats at 120 BPM). Stutters, holds, canon tiles and 0.5× plates decode once; nothing is decoded the program does not show. Streams close after their last frame.
- `frameLedger()` counts every `VideoFrame` opened and closed, by kind (`decoded`, `source`, `canvas`); `live` must end at 0.
- `demux(arrayBuffer)` reads moov (stsd avcC/hvcC, stts, ctts, stss, stsz, stsc, stco/co64) into samples in decode order with display indexes; enough for any faststart H.264 file.

### The monitor's Download MP4

`/videostudio/` has an Export block: one button per format (each a re-layout, never a crop), Master for 24 Mbps, a progress bar with the frame count and time left, Cancel, then links to the captions and the sidecar. The preview pauses while it exports. It waits until Synergy's voice and the lady are loaded, so the file has the whole song.

### Headless

```
node scripts/export-videostudio.mjs --format 9:16 [--scale .5] [--span 936-1008] [--edl track|draft|offsite-psych|studio|metronome|file.json]
    [--track hustle] [--post FILE] [--auto] [--no-cold-open] [--master] [--no-audio] [--out DIR] [--name NAME] [--url http://127.0.0.1:5351 | --port N]

Each track plays its own form (`forms.js formOf`: Offsite the river, without a cold open) and is cast with the voice bank's takes (`castSong` `available`), as /allhands/ and the monitor do; `--auto` lets the post choose its track and its lines, and with `--track` casts the post on that track.
```

`--edl track` (the default) cuts the film with the track's own treatment, as the monitor does; `draft` is drop60-draft whatever the track, or name a treatment. The sidecar's `treatment` says which cut the film.

Without `--url` it starts its own Vite dev server (the project's config, so the media and voice routes are there) on `--port` (default: any free port) with its own dependency cache (`VIDEOSTUDIO_VITE_CACHE`, default under the OS temp dir), so it never re-optimises under another dev server. It exposes `studioServer()`, `launch()`, `exportPage()`, `runExport()`, `pull()` and `saveExport()` for scripts.

### The gates

`npm run check:export` (`--quick` for shorter spans, `--node` for the Node part only, `--keep DIR` keeps the files):

1. Node: the demuxer against the proxies on disk and ffprobe; captions; the draft cut clean in all three formats and byte-stable; one assertion per row of plan §2 it implements.
2. Metronome: `metronomeEDL()` exported full length at 120 BPM (Circle Back) and 130 BPM (Hustle, where a step is 2.77 frames), with a click on every cut. `ffmpeg scdet` must find every cut on its `round(T·24)` frame and nothing else; every click within 1.5 ms of its step.
3. The timing rule, every step at 120, 92, 130 and 108 BPM (Circle Back, Humbled and Honored, Hustle, and Offsite with its swing), nothing chosen: one file per track with two tiles. The top tile cuts black/white on every step at `round(t·24)`; in the file every cut is on its frame and within half a frame of its beat. The bottom tile flashes white for one frame on every step at its hit frame (`{anchor:'step:s', hit:true}`), over a click on every step played through the engine's own master bus (`buildGraph`'s drum bus, glue and limiter), so the sound lands as the engine renders it; in the file every click's audible onset (the first sample within 20 dB of its peak; the Opus encode's pre-echo reads a few tenths of a millisecond earlier at -40 dB, and is printed) falls inside its flash frame: the picture leads by 0 to under one frame, never late. The engine's latency is measured on the clicks and on every kick of each track's real render and must match `AUDIO_LATENCY` within 0.15 ms. The distributions print and land in `timing.json`.
4. Determinism: the same span of the draft cut (the choke, true black, the ignition, stack3) exported twice in fresh pages. Every composited frame's RGBA SHA-256 (`hashFrames`) is identical and the sound's `ffmpeg -f framemd5` is identical. The decoded picture's framemd5 is identical wherever the encoder had nothing to decide and within 45 dB PSNR elsewhere: Chromium's software H.264 encoder is not bit-reproducible above about 720 lines (three encodes of the same synthetic frames give one stream at 270×480 and 404×720, three at 540×960 and 1080×1920), so neither are the MP4 bytes at the share sizes.
5. Leaks and memory: every `VideoFrame` opened is closed; across Drop B the heap stays level and the frame cache empties at the end.
6. Duration: the video and audio tracks are within a frame of the film's 60.000 s. `plan.duration` is 0.6 s longer: the render's tail, which a loop film drops.

### Not yet

- The proxies are 540p, so a full 1080×1920 export upscales them; the master path (`media:'master'`) is checked on a 1080p long-GOP file but not chosen for quality yet.
- Opus, not AAC, wherever the browser lacks an AAC encoder (headless Chromium here). No 24-bit stems file yet; the stems are in the render the export makes.
- Bit-reproducible files need a reproducible encoder: the WebCodecs H.264 encoder is not, and `engine.render()` is not either (its drums, keys and voice stems differ between renders by about -77 dBFS; the dry bass matches), so a full export's sound matches only up to the song engine. The export's own stages (decode, composite, resample, Opus) are reproducible.
- SwiftShader only (CPU-emulated GL, on a shared 4-core machine): 0.7 s a frame at 1080×1920 for a G9 span with the machine quiet, 2.3 s a frame for the whole film under load (56 min), 90 to 210 ms a frame at 270×480. The compositor's GPU work lands in the encode step (the canvas is read back when the encoder takes the frame). Real GPUs and the plan's 40 s budget are untested.
- Cancel takes effect between frames; the sound render (about 80 s for the whole song here) runs to the end first.
- No presigned upload.
