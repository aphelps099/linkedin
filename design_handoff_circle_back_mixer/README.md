# Handoff: Circle Back® — The Professional Phrase Organ

## Overview
Circle Back is a satirical **LinkedIn audio mixer**: a 16-key phrase sampler that speaks corporate LinkedIn clichés ("Humbled and honored to share", "Let's circle back", "Full stop.") over a live-synthesized drum machine, so users can compose songs about corporate cheese. The design language is **Swiss International Style played dead straight as corporate bureaucracy**: paper, ink, one corporate blue, printed rules instead of shadows, form numbers and HR stamps.

## About the Design Files
The files in this bundle are **design references created in HTML** — working prototypes showing intended look AND behavior, not production code to copy directly. The task is to **recreate them in the target codebase's environment** (React, Vue, Svelte, native, etc.) using its established patterns; if no environment exists yet, choose an appropriate framework (the prototype logic is React-shaped, so React is the path of least resistance). The WebAudio synth (`audio.js`) and the sequencer scheduler ARE reference-quality algorithms — port them nearly verbatim.

## Fidelity
**High-fidelity.** Colors, type, rule weights, spacing, copy, and interactions are final. Recreate pixel-perfectly. Numeric values below are exact — do not snap to a 4/8-px grid.

## Design Tokens
Colors:
- Paper (page bg): `#f6f5f1`
- White (cards/keys): `#ffffff`
- Ink (all text, rules, borders): `#111111` · muted meta: `#111111` @ 40% (`#11111166`) · hairlines: `#11111122`
- Corporate blue (THE only color): `#0a66c2` · light tint: `#9fc8ea` (playhead frame, tints on blue) · hover-dark (rarely): `#084d92`
- NO gradients, NO shadows, border-radius 0 everywhere.

Typography:
- Sans: `"Helvetica Neue", Helvetica, Arial, sans-serif`
- Mono: `"IBM Plex Mono", ui-monospace, "SF Mono", Menlo, Consolas, monospace` (Google Fonts)
- Display h1: 104px on posters / **64px in the app**, weight 700, letter-spacing -.045em, line-height .94, color blue
- Dek: 17px (15px in app), line-height 1.45
- House label: 9.5px / 700 / .16em tracking / uppercase (section titles, buttons, masthead meta at .14em)
- Key name: 11.5px / 700 / -.01em · key index: 10px mono
- Readout: 10.5px mono, tabular-nums, blue
- Ticker: 14px mono uppercase, .03em
- Fine print: 8.5px mono uppercase .1em, 40% ink
- Logo: 19px / 700 / -.02em + 9px superscript ®

Rule-weight system (depth is drawn, never shadowed):
- 3px — masthead & footer rules
- 2px — column-section headers
- 1.5px — key plates, dials, buttons
- 1px — sequencer grid
- .75px — key separators inside a plate
- 1px dotted `#11111122` — phrase-index rows

Spacing:
- Page padding 34px (y) / 44px (x), max-width 1120px
- Column grid: `250px 1fr 230px`, 30px gap; 30px between sections
- ZERO gaps inside key plates and sequencer (collapsed borders)
- Sequencer cell height 26px; label column 110px
- Dial diameter 74px; key aspect-ratio 1.45/1

## Screens / Views
One screen: **The Mixer** (`ui_kits/circleback/index.html` + `CircleBack.jsx`).

Top → bottom:
1. **Masthead** — logo "Circle Back®" left; right meta row (uppercase 9.5px/.14em, 28px gaps): "Form CB-16 · Rev. 2026-08 · For internal thought leadership only". 3px rule below.
2. **Headline row** — flex, space-between, items flex-end: h1 blue 64px "The professional phrase organ." (2 lines); right-aligned dek max-width 380px: "Sixteen keys of fluent LinkedIn, spoken in time over a live drum machine. **It's not an instrument. It's a journey.**" (bold sentence in blue).
3. **Ticker** (24px above/below) — full-width blue bar, padding 13px 16px: white chip label "NOW PLAYING" (9px/700/.2em, white bg, blue text, 3px 6px padding) + mono uppercase phrase + white block cursor `▮`.
4. **Three columns** (250/1fr/230, 30px gap), each headed by a 2px-rule section header: uppercase title left, blue aside right.
   - **Phrase index / 01–16**: 16 rows, dotted hairline bottoms, 11.5px, line-height 1.9; blue mono index + full phrase (ellipsis overflow). Armed row: 700 weight, blue. Click = press key.
   - **Keys / Press to opine**: 4×4 **KeyPlate** — 1.5px outer border, keys .75px separators, no gaps. Each key: white, aspect 1.45/1, padding 9px 11px; blue mono index top-left, bold name bottom-left. Active/pressed/armed: solid blue, white text (130ms flash on trigger). Below: kbd hint line, 10.5px 40% ink.
   - **Registers / Cal. A**: 3 dials stacked (16px gap). Dial: 74px circle, 1.5px ink ring, white fill, blue 2px needle from center (rotation −135°→+135° over 0–1), 6px ink hub. Beside it: label + blue mono value. Dials: Sincerity (default 12%), Delivery (50%), Tempo (96 BPM, range 60–200).
5. **Sequencer · 16 steps** (aside = mono position readout `01`–`16` or `—`) — CSS grid table `110px repeat(16,1fr)`, 1px ink borders all around (collapsed), 26px rows. Rows: Kick, Snare, Clap, Cl. hat, Op. hat, Shaker, Cowbell, Zap, **Vox**. Drum cell states: white → blue (hit) → ink (accent) → white. Vox cells: white with blue 9px mono 2-letter phrase code. Row label: uppercase 9.5px/.14em; selected row label inverts to ink bg/white text. Playhead: inset `0 0 0 2px #9fc8ea` frame on the current column's cells.
   Transport row (16px above): buttons **Convene/Adjourn** (latched blue while playing), **Minute-take** (record; latches INK), **Load agenda**, **Table it**; right-aligned muted label "Vox cells stamp the armed phrase · drums cycle hit / accent".
6. **Footer** — 3px rule; muted labels "An equal opportunity instrument" / "Circle Back® is not affiliated with your network"; right: **Stamp** — "APPROVED — HR", 2px blue border, blue text, 10px/700/.2em, padding 6px 10px, rotate(−4deg).

## Interactions & Behavior
- **Button**: white, 1.5px ink border, uppercase label, padding 10px 15px. Hover AND press: invert to ink bg / white text (.08s background transition). Latched on: blue bg/white (rec variant latches ink).
- **Key press** (click / Enter / Space when focused, or keyboard `1234 qwer asdf zxcv` mapped to keys 1–16): flashes blue 130ms, arms the phrase, speaks it, prints it on the ticker. If recording while playing, stamps it into the Vox row at the current step.
- **Dial drag**: vertical drag (180px = full range), Shift = 0.4× fine, double-click = reset to default, wheel = ±3%.
- **Sequencer**: click drum cell cycles off→hit→accent→off; click vox cell toggles the armed phrase's code; drag paints the first-clicked value across cells.
- **Space** toggles play ("convenes/adjourns the meeting").
- **Playback**: lookahead scheduler — 25ms interval, schedules everything within a 120ms horizon against the AudioContext clock; step duration = 60/tempo/4 s. Drum velocity: accent 1.0, hit 0.72. Vox steps + playhead UI fire via setTimeout at (stepTime − now).
- **Speech**: `speechSynthesis` — pitch = 0.4 + Sincerity×1.4, rate = 0.6 + Delivery×0.8; each new utterance cancels the previous (monophonic vox).
- Audio init is lazy (first gesture) to satisfy autoplay policies.

## State Management
- `pattern: number[9][16]` — drums 0/1/2; Vox row 0 or phraseIndex+1
- `armed` (0–15), `ticker` (string), `playing`, `rec`, `pos` (0–15 | null), `tempo` (60–200), `sinc`/`deliv` (0–1), `selRow`
- A mutable ref mirrors state for the scheduler loop (avoids stale closures).
- Seed pattern ("Load agenda"): kick [0,3,8,10] acc[0,8]; snare [4,12] acc; clap [12]; cl.hat every 2nd acc[0,8]; op.hat [7,15]; shaker [3,7,11,15]; Vox: step 1 = "Humbled"(idx 1... value 2), step 7 = "Circle back"(6), step 13 = "Full stop"(16).

## The Drum Synth (port verbatim)
`design_files/audio.js` — pure WebAudio, no samples: master gain (.85) → compressor (−6dB, 12:1, 3ms/150ms) → destination; shared 2s noise buffer. Voices: kick (150→46Hz sine sweep + 1.2kHz noise click), snare (2kHz HP + 1.9kHz BP noise + 185→120Hz triangle), clap (3 pre-hits at 0/11/23ms + tail through 950Hz BP), closed/open hat (6 detuned squares at metallic ratios [2,3,4.16,5.43,6.79,8.21] × 40Hz through 7.5kHz HP + 10kHz BP; decay .052 vs .42), shaker (6.2kHz BP noise), cowbell (540+800Hz squares, 2.6kHz BP), zap (1900→55Hz sine sweep). Exponential envelopes throughout.

## Phrase Data
16 keys (code · name · spoken text) in `CircleBack.jsx.txt` `PHRASES`; the fuller research-derived bank (openers/buzzwords/AI-tells/closers/broetry) is `design_files/lexicon.js`.

## Copy Rules (voice)
Deadpan corporate bureaucracy, never winking: form numbers, calibrations, meeting verbs (Convene, Adjourn, Minute-take, Table it), HR stamps. Tagline uses the mocked AI construction itself: "It's not an instrument. It's a journey." No emoji, no icons — unicode only (`▮ · — ®`).

## Assets
No image/icon/logo assets exist — the wordmark is plain type. IBM Plex Mono loads from Google Fonts; Helvetica Neue is the system stack.

## Files
- `design_files/index.html` — entry (React 18 + Babel standalone prototype)
- `design_files/CircleBack.jsx.txt` — the whole screen + scheduler + state (suffixed .txt so the design tool does not compile it; rename when porting)
- `design_files/audio.js` — drum synth + speech wrapper (port this)
- `design_files/styles.css` + `design_files/tokens/` — design tokens as CSS custom properties
- `design_files/components_reference.md` — all design-system primitives (Masthead, Ticker, Bay, Silk, Readout, Stamp, Button, Knob, Kbd, Pad/KeyPlate, StepGrid): JSX source + `.d.ts` prop contracts + usage notes in one file
- `design_files/readme.md` — full brand guide
Note: `index.html` references a compiled `_ds_bundle.js` from the design tool; in your implementation, import the components directly instead.
