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

**Whole words in stutters:** a fragment is never shown alone. Her ladder's "LE" and "LET'S BU-"
(and any recast ladder's fragments), the intro's tease of BACK. and Synergy's stammer show the
whole word or words they come from (`choreo.js wholeWords`, `ladderWhole`): the letters that sound
lit at full, the rest a flat ghost at `FRAGMENT_GHOST` (.2), so the word always reads and the
stutter still shows as the lit letters re-pop on every retrigger (the fast rungs move them, never
flash them). A screen word's `lit` says how many of its leading letters sound; `screen.fragment`
keeps what is heard. Two words may stack on two lines (`lines:2`) so both are up at once.
/allhands/'s caption line does the same with its dim and lit spans.

**Timing:**
- 120 BPM; a 16th is 0.125 s.
- A peg lights on frame `floor((t + .010) · fps)`: it may lead the audio by up to 25 ms and never lags it.

**Checks** (each fails the build when a rule breaks):
- `npm run check:pixel-type`: faces, kerning, normalize, and every fit (lady phrases, host lines, 60 fixture posts × 3 formats at P ≥ 9).
- `npm run check:eq`: bands, follower, live vs export correlation, score accents.
- `npm run check:pegboard`: screens, onsets within a frame, determinism, true black, ignition, governed flashes; every fragment screen (all three tracks, both posts, every ladder the casting can give her, the Sound check's stammer) shows its whole words with the lit letters equal to the sounding part, peg for peg, on one page, re-popping on every retrigger.

**Specimen:** `/pixel-type/` (noindex) is the proof sheet for sign-off. It runs on these modules, so what it shows is what ships. Add `?renderer=2d` to see the fallback.

