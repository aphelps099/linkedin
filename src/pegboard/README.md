# Peg Board

The light-board type and the in-scene equalizer for All Hands. Each word is
made of round pegs that light up, blue and white on a black board. The full
rendering spec is in the P2 plan; this file records the contracts the modules
share.

| Module | Owns |
|---|---|
| `board.js` | Peg state: typed arrays per peg, plus the palette and the socket colours. |
| `fonts/peg9.js`, `peg5.js`, `peg3.js` | Hand-drawn capital faces: PEG-9 Heavy (7×9, 2-peg stems), PEG-5 (5×7) and PEG-3 (3×5). |
| `font.js` | Compiles a face into masks, stroke order and kerning. Also normalizes text and wraps and fits it to a format. |
| `renderer-gl.js`, `renderer-2d.js` | Draw a board. Same contract (see `board.js`); WebGL2 first, Canvas2D as the fallback. |
| `eq.js` | Frequency bands, the level mapping, a deterministic follower (instant rise, timed fall, peak hold) and the offline `eqTrack`. |
| `choreo.js` | Turns a song plan into cues; `paint(board, t)` lights the board for any moment. It is a pure function of time, so preview, scrubbing and export match. |
| `governor.js` | Flash limiting (Harding-style) on predicted frame luminance. |
| `renderer.js` | The factory: WebGL2 first, Canvas2D when it fails, and a swap to 2D on context loss (`onSwap` hands over the new canvas). `QUALITY_STEPS` is the phone step-down order. |
| `stage.js` | One board on a page: sizing, the song's screens, the department chart, the governor track, one draw per frame. `/allhands/` uses it; export will too. |

**Physical rules:**
- A shot has one pitch.
- Glyph bits become k×k blocks of pegs, with k from 1 to 4.
- Pegs leave their sockets only on purpose; the empty socket stays visible.

**Timing:**
- 120 BPM; a 16th is 0.125 s.
- A peg lights on frame `floor((t + .010) · fps)`: it may lead the audio by up to 25 ms and never lags it.

**Checks** (each fails the build when a rule breaks):
- `npm run check:pixel-type`: faces, kerning, normalize, and every fit (lady phrases, host lines, 60 fixture posts × 3 formats at P ≥ 9).
- `npm run check:eq`: bands, follower, live vs export correlation, score accents.
- `npm run check:pegboard`: screens, onsets within a frame, determinism, true black, ignition, governed flashes.

**Specimen:** `/pixel-type/` (noindex) is the proof sheet for sign-off. It runs on these modules, so what it shows is what ships. Add `?renderer=2d` to see the fallback.

