# Studio 02 — the remix room

Independent preview at `/studio-2/`. The existing `/studio/` and its shared
`stage.css` are unchanged. Studio 02 is noindex while the direction is reviewed.

## Sound

Six original, newly arranged multitracks derived from the approved Office Anthems
and Mutual Alignment production recipes: Offline, Circle Back Forever, Mutual
Alignment, Humbled & Honored, Synergistically Speaking, and No Action Required.
These are fresh arrangements, not the previously delivered stereo masters.

Each has four separately mixed eight-bar layers (drums, bass, keys, lift), original
chord progressions, bass parts, motif answers, swung percussion and small drum
stairs. A 32-bar performance advances automatically to the next track. The two
voices are vintage Flite kal16 and slt with the approved band-limited PA processing.
No external generation calls occur during playback.

`score.json` is the editable composition and dialogue source. Every song has four
coherent call/response pairs and a second, more jargon-heavy Visionary script.
Six vocabulary pads insert whole connected pairs into the next four-bar slot.
Changing confidence or voice affects the next pair. Energy changes the four stems
on the next bar. Beat only mutes speech; Circle back returns to the opening phrase
on the next four-bar boundary. Controls do not claim to edit baked-in stereo vocals.

The intentionally deferred custom-text feature is not shown as a nonfunctional
control. This first phase concentrates on the curated tracks and remix performance.

## Assets and rebuilding

Run `python scripts/render-studio2.py` with numpy, scipy and FFmpeg (Flite and
libmp3lame support). It writes the MP3 audio sprites under `public/studio-2/audio/`
and measured sample offsets/durations to `audio-manifest.json`. The build is seeded
and deterministic within the same audio toolchain. The original recipes were
created for this project; no third-party music recordings or external samples.

Each music sprite contains four contiguous, exact eight-bar segments. Voices are
packed with short silent separators; actual clip lengths determine response timing.
All rendered pairs are checked against the fastest four-bar slot they can occupy.
The Web Audio scheduler uses audio-clock timestamps and reads only the current
track's pack, with a bounded two-track cache plus the vocabulary sprite. It unlocks
audio from a user gesture and makes no network request before play.

## Interface and verification

The racing-team stage returns: full-viewport ASCII character weather, the angular
Get LinkedInified team banner with subtle carbon texture, a large transparent
square monitor, and giant TT Hoves phrases with a typewriter reveal. Room and
monitor use the original ASCII renderer, supplied with this engine's real spectrum.
Animation pauses when the stage is offscreen or the tab is hidden; reduced motion
uses a still field and complete text. The default view prioritizes the performance.
Tracks, vocabulary pads and mix controls open in accessible drawers below the
continuous glass deck. Keyboard controls, seek, mute, volume, cancellation,
error recovery and reduced-motion support are included. Original studio is linked.

`node scripts/check-studio2.mjs` checks the recorded phrase timing, source lifecycle,
stereo stem boundaries, seeks, pause/resume, cancellation races, vocabulary queues,
voice/energy controls and automatic advance. `npm run build` verifies all routes.
Browser visual/audible QA was unavailable in this editing session.
