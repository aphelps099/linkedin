# Circle Back® — Design System

Design system for **CIRCLE BACK**, "the professional phrase organ": a working LinkedIn audio mixer that pairs a live-synthesized drum machine with spoken corporate phrases ("Humbled and honored to share", "Let's circle back", "Full stop.") so you can make songs about how corporately cheese LinkedIn is. Visual direction: **Swiss International Style played dead straight as corporate bureaucracy** — chosen by the user from exploration `explorations/Circle Back Directions.html`, frame 2a.

## Sources
- Original codebase: `drums--ascii/transient-16.html` (local mount; copied to `reference/transient-16.html`) — the TRANSIENT·16 drum synth whose WebAudio engine powers the mixer.
- Phrase material: user-supplied "LinkedIn Cringe Lexicon" research, distilled into `assets/lexicon.js`.
- v1 of this system recreated TRANSIENT·16's dark hardware aesthetic; it was replaced wholesale by the Circle Back rebrand (Aug 2026).

## Content fundamentals
- **Voice = deadpan corporate bureaucracy.** Forms and revisions ("Form CB-16 · Rev. 2026-08"), calibrations ("Cal. A"), HR stamps. The satire is in playing it perfectly straight — never wink.
- **Labels** are 1–2 words, uppercase, tracked: `PHRASE INDEX`, `REGISTERS`, `KEYS`. Asides are dry jokes in the same register: "Press to opine", "For internal thought leadership only", "Price: your dignity".
- **Buttons are meeting verbs**: Convene, Adjourn, Minute-take, Load agenda, Table it.
- **The tagline construction is the mocked AI-tell itself**: "It's not an instrument. It's a journey."
- Numbers always mono (IBM Plex Mono), tabular: `01`, `96 BPM`, `12%`. Empty value is `—`. Fine print in mono small caps: "An equal opportunity instrument", "Circle Back® is not affiliated with your network".
- No emoji, no icons. `·` separates; `®` and `℠` decorate the wordmark.

## Visual foundations
- **Color**: paper #f6f5f1 page, white #ffffff cards/keys, ink #111 for all text and rules, and exactly ONE color — corporate blue **#0a66c2** (active fills, ticker bar, needles, indices, headline). #9fc8ea only as tint on blue fields/playhead. No gradients, no shadows, no radii — flat print.
- **Type**: Helvetica Neue system stack. Display: huge, tight (-.045em), bold, often blue, lines like ".94 leading". Labels: 9.5px/700/.16em/uppercase. Mono (IBM Plex Mono via Google Fonts @import) for indices, readouts, ticker, fine print.
- **Depth is drawn with rule weights, never shadows**: 3px masthead/footer, 2px section headers, 1.5px plates/dials/buttons, 1px sequencer grid, .75px key separators, dotted hairlines for index rows.
- **Layout**: page padding 34/44px; 250 / 1fr / 230 column grid, 30px gaps; ZERO gaps inside key plates and sequencer (collapsed borders).
- **States**: hover/press = invert to ink; latched = blue fill white text (record latches ink); armed key = blue; playhead = inset 2px #9fc8ea frame; focus relies on borders.
- **Motion**: near none — .08s background transitions only. Content changes are instant, like a form being stamped.
- Corporate-mock furniture: approval Stamp (rotated −4°, blue border), form numbers in the masthead, fine-print footer.

## Iconography
None. No icon set, no SVG art. Unicode does the work: `▮` ticker cursor, `·` separator, `—` empty, `®`. Keyboard keys are `<kbd>` chips. **Do not introduce icons.**

## Logo
No logo file. Wordmark is plain type: **Circle Back®** — Helvetica 700, -.02em, ® superscript. On blue fields, white.

## Fonts
- Helvetica Neue: system stack (no binary).
- IBM Plex Mono: Google Fonts `@import` in `tokens/fonts.css` (no local binary shipped — flag: supply .woff2 files if offline use is needed).

## Index
- `styles.css` → `tokens/{fonts,colors,typography,spacing,effects}.css`
- `components/chassis/` — Unit, Masthead, Ticker, Bay, Silk, Readout, Stamp
- `components/controls/` — Button, Knob (register dial), Kbd
- `components/pads/` — Pad (phrase key), KeyPlate
- `components/sequencer/` — StepGrid (ruled table, vox rows)
- `ui_kits/circleback/` — the working mixer (drums + speech)
- `assets/lexicon.js` — full LinkedIn phrase bank (openers / buzzwords / AI tells / closers / broetry)
- `guidelines/` — specimen cards · `explorations/` — direction canvas · `reference/` — original source
- `SKILL.md` — agent skill entry point

## Intentional additions
Masthead, Ticker, Stamp, KeyPlate — extrapolated from the chosen 2a mock (they appear in it); no other inventions.
