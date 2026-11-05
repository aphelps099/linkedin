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
| `psych.js` | Psychedelic imagery on the dot grid: eight generative looks painted into a board after its type, pure functions of (board size, time, the music, seed, params). The video takes them as `{type:'psych'}` board cues (videostudio README, Psych cues). |

**Physical rules:**
- A shot has one pitch.
- Glyph bits become k×k blocks of pegs, with k from 1 to 4.
- Pegs leave their sockets only on purpose; the empty socket stays visible.

**Whole words in stutters, fully lit:** a fragment is never shown alone, and never dim. Her ladder's "LE"
and "LET'S BU-" (and any recast ladder's fragments), the intro's tease of BACK. and Synergy's stammer show
the whole word or words they come from (`choreo.js wholeWords`, `ladderWhole`), every letter at full
(`FRAGMENT_FULL`, 1; a fast rung's steady 1.15) from the screen's first frame to its last. The letters
that sound wear a white-hot accent (`FRAGMENT_ACCENT`, a .55 white mix) and re-pop on every retrigger:
the slow rungs (half a bar and slower) with a short white-hot pop (white toward 1, the light overdriven
for about 60 ms, the peg springing), the fast rungs (a quarter note and faster, reveal `steady`) with
the light held and the letters moving instead (the size kick, the rung's row shift), so the climax
never strobes. On all four tracks the stutters need no governing (at most 2.5 flashes a second
ungoverned, whole and by quarter, gain 1 on every stutter frame). A screen word's `lit` says how many
of its leading letters sound; `screen.fragment` keeps what is heard. Two words may stack on two lines
(`lines:2`) so both are up at once. /allhands/'s caption line does the same: the whole word in full,
its sounding letters hot.

**No partial words while typing:** a typewriter screen (her tag "LET'S CIRCLE-", her whole-phrase
rungs "LET'S BUILD.", "FULL STOP.", the board's own titles) shows its whole phrase from its first
frame as a dim read-ahead ghost at `READ_AHEAD` (.1), as Synergy's lines do, and lights each letter
as it types; it never reads "L", "LE".

**The choke's black:** the board goes true black on the first frame after her tag stops sounding plus
`CHOKE_TAIL` (30 ms): the choke cuts her hard, and a codec's own floor outlasts a hard cut (Opus
about 25 ms at -66 to -70 dBFS, `CODEC_FLOOR`). The endings keep `TAG_TAIL` (5 ms).

**Psych imagery on the dot grid (`psych.js`):** the board as an image, lit on the same pegs as the type.
`paintPsych(board, {look, seed, params, fade}, t, {drive, frame})` paints one look into a board that
`choreo.paint` has already lit for that moment; `psychField(look, cols, rows, t, ...)` is the bare field.

| Look | What it is | Its own params (defaults) |
|---|---|---|
| `ripples` | Rings born on every beat, travelling out from the centre or from one peg; a signal ring leaves each bar. | `spacing` (6 pegs), `px`, `py` (a peg to ripple from; -1: `cx`, `cy`) |
| `spiral` | Arms that wind in and turn an arm every bar; the claps push them on. | `arms` (3), `twist` (1.2 turns centre to edge) |
| `pinwheel` | Blades in two rings turning against each other, apart on a dark seam; a signal blade among the blue. | `blades` (8) |
| `moire` | Two ring sets from centres orbiting each other over 4 bars; the fringes where they agree burn toward white. | `spacing` (5), `spread` (.55 of the short side) |
| `plasma` | A slow colour field of four summed waves, cycling deep, blue, white, signal. | |
| `mandala` | Rings cut into petals by a folded angle, 6, 8 or 12-fold; alternate rings weave half a petal over. | `fold` (8), `petals` (2) |
| `lissajous` | Figures traced through time (a figure loops every 4 bars): a white-hot head, a trail cooling to deep. | `a` (3), `b` (2), `curves` (2), `trail` (10 beats) |
| `footage` | A picture taken over by pegs, one sample a peg (`frame`: `{cols, rows, data}` RGBA, top row first), local contrast sharpened, warm light to signal, cool light and green to blue, shadows to deep, bright grey to white. | `gamma` (1.15), `sharpen` (.9), `colour` (1) |

Every look also takes `level` (.85), `speed` (1), `scale` (1), `cx`, `cy` (.5) and `breath` (1: how much
the music moves it). The rules, all checked:
- **The music:** `driveTrack({plan, features})` reads the voices (the loudest of `stems.voice`, `lady`,
  `choir`, enveloped at attack .25 s, release .9 s) and the clap loop (`features.clap`, release .35 s)
  from the feature tracks the video builds (`edl/params.js`), or from the plan alone (his words and her
  events; `plan.claps` or the backbeat), or from a bare tempo (the specimen). The beat is counted on the
  quarter notes of `plan.timing`, so swing never wobbles a cycle. The voices carry the light (.62 to 1),
  the claps swell the pegs (size, never light) and push the motion; the beat drives every cycle.
- **The palette and nothing else:** blue, white, signal and deep tones, intensity up to `PSYCH_MAX` (.95,
  under the type's 1), the white mix and peg size. Never green.
- **Type always wins:** every peg already lit is type (or the board's own light) and is never relit; a
  moat a peg wide around it stays dark; the pattern dims toward the words within `TYPE_HALO` (5 pegs) and
  runs at `TYPE_DIM` (.55) of its light while any word is lit.
- **Slow flows, never flashes:** light moves only with the slow voice envelope; each look keeps its
  average light steady as it moves. On all of Offsite, at the home's 150 x 48 and the 9:16 frame's
  83 x 147, every look holds at most 2 flashes a second ungoverned (whole and by quarter) and needs no
  governing; under Offsite's words it adds no flash to the words' own.
- **True black stays black:** nothing is painted on a board whose exposure is 0 (the choke).

**Timing:**
- 120 BPM; a 16th is 0.125 s.
- A peg lights on frame `floor((t + .010) · fps)`: it may lead the audio by up to 25 ms and never lags it.

**Checks** (each fails the build when a rule breaks):
- `npm run check:pixel-type`: faces, kerning, normalize, and every fit (lady phrases, host lines, 60 fixture posts × 3 formats at P ≥ 9).
- `npm run check:eq`: bands, follower, live vs export correlation, score accents.
- `npm run check:pegboard`: screens, onsets within a frame, determinism, true black, ignition, governed flashes; every fragment screen (all four tracks, both posts, every ladder the casting can give her, the Sound check's stammer) shows its whole words at full on every painted moment, nothing dim, the accented letters equal to the sounding part, peg for peg, on one page, re-popping on every retrigger, and needing no governing; every typewriter phrase of every track (her tag, her whole-phrase rungs, "FULL STOP.", the titles) whole on its first frame, the letters still to type at the read-ahead ghost; the choke dark from her tag's end plus `CHOKE_TAIL`.
- `npm run check:pegboard` also runs every psych look on all of Offsite at two board sizes: deterministic, palette only and never green, at most 2 flashes a second ungoverned with no governing, breathing (voices, claps, beat), dark at exposure 0; and under Offsite's words: every type peg exactly as choreo lit it, a dark moat, dimmer near the words, no added flash.

**Specimen:** `/pixel-type/` (noindex) is the proof sheet for sign-off. Its Psych section (09) shows every look live with its caption, on a stage with "LET'S BUILD." over it to prove the words win; the footage look reads Kevin's poster through the grid. It runs on these modules, so what it shows is what ships. Add `?renderer=2d` to see the fallback.

