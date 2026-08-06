# Circle Back® — Design System

*Form CB-DS · Rev. 2026-08 · For internal thought leadership only*

**Umbrella tagline (LinkedIn Beats):** *“Unlocking Synergistic Rhythms for Professional Communicators”* — Title Case intact; it quotes the genre.

Circle Back is a **family of satirical tools about LinkedIn culture that are secretly useful**. The joke is the
exaggeration of corporate LinkedIn; the utility is that the output is genuinely good. Everything runs in the
browser — nothing is sent anywhere — and everything is styled as deadpan corporate bureaucracy.

| Product | Form | What it is |
| --- | --- | --- |
| **Circle Back®** — the professional phrase organ | CB-16 | A post-to-beat mixer. A 16-key phrase sampler speaks corporate clichés in time over a live-synthesised drum machine; a 1080×1080 broadcast monitor exports the result as an mp4 for the feed. *"It's not an instrument. It's a journey."* |
| **LinkedIn Lessons™** — the guided post generator | LL-7 | Six doors, a Mad Libs interview that talks back, and the **LinkedInification dial**: five levels from *1 · Almost Human* to *5 · Corporate Hallucination*. Same facts, escalated. *"What are we pretending to be humbled about today?"* |
| **Roast My LinkedIn™** — the inspection office | RM-1 | Paste a post, a headline or an About section; pick one of four inspectors and an intensity up to *HR Violation*. Every roast ends in redemption: the version you should actually publish. *"Present your personal brand for inspection."* |
| **The Museum of Professional Communication** | MM-1 | A redacted gallery of the genre's greatest hits, a Redaction Office that anonymises submissions in the browser, and a placard history of the professional internet. *"Authors anonymized. Clichés immortal."* |

The four tools link to each other in one direction each: Lessons hands a finished post to the mixer, the Museum
sends an exhibit to Roast or the mixer, Roast sends the original to the mixer. Every product is
**"not affiliated with your network."**

---

## Sources

Everything here is derived from source, not from screenshots.

- **GitHub — [github.com/aphelps099/linkedin](https://github.com/aphelps099/linkedin)** (branch `main`) — the
  live product. Read further for anything this system does not cover; the code is the ground truth.
  - `src/tokens/*.css` → the token files here, value-for-value
  - `src/components/{chassis,controls,pads,sequencer,stage,remix,broadcast}/` → the component inventory
  - `src/CircleBack.jsx`, `src/lessons/Lessons.jsx`, `src/roast/Roast.jsx`, `src/museum/Museum.jsx` → the UI kits
  - `src/lexicon.js`, `src/feed.js`, `src/lessons/categories.js`, `src/roast/personas.js`,
    `src/museum/{exhibits,timeline}.js` → the copy, verbatim where quoted
  - `design_handoff_circle_back_mixer/README.md` → the original design handoff, with exact numeric values
  - `public/` → the generated icons, OG cards and image library copied into `assets/`
- **Live site:** [linkedinbeats.com](https://linkedinbeats.com) — the mixer at `/`, Lessons at `/lessons/`,
  Roast at `/roast/`, the Museum at `/museum/`.
- **Not provided:** no Figma file, no slide template, no font binaries, no logo file. See *Iconography* below.

---

## VISUAL FOUNDATIONS

**Swiss International Style played dead straight as corporate bureaucracy** — as if a very serious HR
department designed a musical instrument. Flat, precise, form-like. Never winking.

### Colour
The entire palette is four values and one accent.

| Token | Value | Use |
| --- | --- | --- |
| `--paper` | `#f6f5f1` | Every page |
| `--white` | `#ffffff` | Cards, keys, panels, cells |
| `--ink` | `#111111` | **All** text, rules and borders |
| `--ink-40` | `#11111166` | Muted meta, fine print, hints |
| `--hair` | `#11111122` | Hairlines and dotted rules |
| `--blue` | `#0a66c2` | THE corporate blue: fills, active states, links, headlines, readouts |
| `--blue-light` | `#9fc8ea` | Playhead frames, readouts on blue, dial ladders below the current level |
| `--blue-dark` | `#084d92` | Hover — used rarely; hover normally inverts to ink instead |

There are **no greys** (transparent ink does that job), no gradients, no tints beyond the two blues.
Colour never encodes meaning: there is no green success and no red danger — `--danger` is ink, because the
record button latches black. The stage inverts the whole system: a flat blue field with white outlines,
white fills and blue text.

### Type
Two families, no exceptions.

- `--sans`: **"Helvetica Neue", Helvetica, Arial, sans-serif** — everything.
- `--mono`: **IBM Plex Mono** (Google Fonts) — data, form numbers, readouts, phrase codes, positions,
  exhibit slugs, keyboard hints. Never prose.

Headlines are large, tight and bold: `700 / -.045em / .94` line-height, **always blue** — 104px on posters,
64px in the app, 40px on product headers. Section heads run 27px (interview questions) / 22px (wings) /
19px (card titles) at -.02 to -.03em. Dek is 13px at 1.45; body is 13.5px at 1.55 — and the one bold sentence
in a dek is always blue. The **house label** is the system's signature: 9.5px, 700, `.16em` tracking,
uppercase (`.14em` in mastheads and sequencer row labels), down to 8.5px for the finest print.
The Thought Leadership Index sets at 56px / `-.05em` blue.

### Depth
**Hierarchy is drawn, never shadowed.** Depth is a rule-weight ladder and nothing else:

`3px` masthead & footer · `2px` section headers & stage keys · `1.5px` cards, buttons, dials, key plates ·
`1px` sequencer grid & hairlines · `.75px` key separators inside a plate · `1px dotted #11111122` list rows.

`--radius-none: 0px` and `--shadow-none: none` exist only to be zero. **Border-radius is 0 everywhere**;
the only round things in the system are the register dial, the comment-card avatar disc and the vox-lock radio.
There is exactly **one** shadow in the whole system: the broadcast monitor floating on the blue stage carries
`--stage-lift` plus a `blur(14px) saturate(1.15)` backdrop and a 1px 42%-white frame. Nowhere else. Ever.

### Backgrounds & imagery
Pages are flat paper; cards are flat white; the ticker and the stage are flat blue. **No textures on paper.**
The one texture in the system is the stage `Backdrop`: a full-window canvas of sparse monospace glyphs over
`#0a66c2` with a radial ramp that clears around the monitor so the eye lands on the words, plus a film of grain.

Photography is the **image library** (`assets/library/`): corporate stock photography, if stock photography had
robots in blazers — cool, even, fluorescent, deadpan, captioned like a museum ("The handshake", "The trust fall",
"Executive portrait, 1957"). It appears only inside the broadcast, as a cut in an exported clip; it is never a
hero image and never a page background.

### Motion
Fast, mechanical, tiny. `--ease-ui: .08s` on button background and colour; `--ease-key: .07s` on stage keys;
a `130ms` blue flash when a pad is struck and `140ms` on a stage key. The comment card fades and rises 10px
over 380ms with a cubic ease-out — the only easing curve in the system with an opinion. **No bounces, no
springs, no slide-ins, no scroll animation, no parallax, no page transitions.** The teletype reveal on the
monitor and the walking playhead are the only continuous motion.

### States
- **Hover and press are the same gesture: invert to solid ink**, white text. Buttons, category cards,
  sequencer row labels. Nothing dims, nothing lightens, nothing scales, nothing lifts.
- **Latched** controls fill blue with white text; `variant="rec"` latches **ink** instead.
- **Armed / selected** is a blue fill (pads, dial levels, segmented options) or an ink fill (row labels).
- **Playhead** is an inset `2px --blue-light` frame — never a background change.
- **Focus** relies on the browser default; `outline:none` on text inputs, whose 1.5px ink border is
  already the strongest edge on the screen.
- **Empty** is a 2px dashed 22%-white frame reading `AWAITING ENGAGEMENT`.
- **Disabled** does not appear anywhere in the product: an action that cannot run is not rendered.

### Layout
1120px measure, centred; page padding 34px vertical / 44px horizontal (20/14 under 880px). Sections are
30px apart; the column grid is `200px 1fr 230px` with a 30px gap. Key plates and the sequencer have **zero**
internal gap — borders collapse so the plate reads as one drawn object. Fixed dimensions worth memorising:
sequencer cell 26px, label column 110px (84 narrow), dial 74px, key aspect ratio 1.45/1, stage key and comment
card 104px. Narrow-viewport behaviour is a JS `matchMedia` flag passed as a `narrow` prop, because the system
is inline-styled and media queries cannot reach it.

### Transparency & blur
Transparency is only ever ink or white at a fixed step (`66`, `22`, `.72`, `.42`, `.22`, `.06`). Blur appears
exactly once, on the monitor on the stage. No frosted panels, no protection gradients, no scrims — text on
blue is white and needs no help.

---

## CONTENT FUNDAMENTALS

**Deadpan, institutional, satirical — and never winking.** The bureaucracy is played completely straight; the
joke is that nobody involved thinks it is a joke. If a line needs a nudge to land, it is the wrong line.

- **Every surface is a form.** A form number leads every masthead (`Form CB-16`, `Form LL-01`, `Form RM-1`,
  `Form MM-1`), followed by a revision (`Rev. 2026-08`) and one institutional line: *For internal thought
  leadership only* · *Complaints processed locally* · *Admission free* · *Guided thought leadership*.
- **Institutional verbs, not app verbs.** Convene, Adjourn, Table it, Load agenda, Minute-take, File the
  complaint, Submit to the collection, Strike, Admit into the record, Reorg. Never "Save", never "Get started".
- **Machines report; they do not chat.** `ON THE RECORD 12/32` · `CLEARED FOR THE FEED` · `Cal. A` ·
  `≈ 20s` · `112 BPM` · `5 redactions performed`. Uppercase mono, tabular numerals, no exclamation marks.
- **Second person, imperative.** The system addresses *you* and tells you what to do: "Present your personal
  brand for inspection." "Paste your LinkedIn post here. Yours works best." First person appears only inside
  quoted LinkedIn content, which is the joke.
- **The form talks back.** Every answer earns a deadpan reaction: *"Excellent. Let's make Sarah's employment
  feel historically significant."* · *"Noted. We will imply the role was created by fate."* · *"A number is
  about to become a movement."* · *"Riveting. Now we monetize it emotionally."*
- **Reassurance is mandatory** wherever a user pastes text: *"never leaves your browser"*, *"Everything is
  generated in your browser. Nothing is sent anywhere."*, *"in your browser, before anything is sent anywhere."*
- **The satire uses the target's own construction.** The tagline is an AI tell: *"It's not an instrument.
  It's a journey."* The verdicts are HR language: *"A roast that legally should have been an email."*
- **Museum register for history.** The events are real; the tone is a placard's: *"Your aunt endorses you for
  Java. You do not know Java."*
- **Every product closes with a disclaimer.** *"Circle Back® is not affiliated with your network."*
  *"The museum is not affiliated with your network. The gift shop is the tools."*
- **Casing:** sentence case in body and buttons (CSS uppercases the labels — write "Run of show", not
  "RUN OF SHOW"); Title Case for product and wing names; ALL CAPS only inside machine readouts and
  `[REDACTED PLACEHOLDERS]`.
- **Punctuation:** the middot `·` separates meta items; the em dash `—` joins a verdict to its authority
  (`APPROVED — HR`); the ellipsis is a character, not three dots. Numbers are precise enough to sound
  measured and round enough to be marketing ("312% more qualified leads").
- **Emoji: never in the brand's own voice.** They appear only in quoted LinkedIn content — a phrase key that
  says "Onwards and upwards! 🚀", the comment card's 👍, an exhibit's nine rockets. That is a quotation of the
  genre, not a house style. Never put an emoji in a label, a button or a heading.

---

## ICONOGRAPHY

**There is no icon system, no icon font, no SVG sprite, and no icon component — by design.** A very serious HR
department would not commission icons. The system draws what it needs and types the rest.

- **Unicode does the work**, and only these: `▮` the ticker's block cursor · `◀ ▶` the arcade arrows at 34px ·
  `▸` audition an exhibit · `×` strike it · `→` a roast finding or a forward link · `↓` a download ·
  `♫` turn it into a beat · `✓` copied · `®` Circle Back · `™` Lessons and Roast · `·` the meta separator ·
  `—` the stamp dash. See `guidelines/brand-glyphs.html` for the full set.
- **Geometry is drawn in CSS, not in SVG.** The dial needle is a 2px rotated `<span>`; the playhead is an
  inset box-shadow; the equalizer is flex children with percentage heights; the vox lock is a bordered circle
  with a 6px disc inside. If you need a new "icon", draw it with borders — do not import a set.
- **No CDN icon library is linked, and none should be.** Lucide, Heroicons, Material and friends all carry a
  rounded, friendly stroke language that would fight this system on sight.
- **`assets/marks/`** holds the products' favicons and app icons — PNGs the app **generates itself** with the
  broadcast monitor's own canvas vocabulary (the wordmark monogram, the masthead rule, the beat ribbon, the
  equalizer, the HR stamp). `assets/social/` holds the four 1200×630 OG cards drawn by the same hand.
- **No logo file existed originally.** For products, the wordmark is plain type (Helvetica Neue 700 at -.02em with a 9px superscript ®/™). **The umbrella company, LinkedIn Beats, now has a formal mark** — see `guidelines/linkedin-beats-mark.html`: primary is the Cursor wordmark (`LinkedIn Beats▮`, cursor always blue / blue-light on blue), avatar is the `LB▮` square monogram, and the equalizer bars are reserved for audio surfaces only. Never draw, reconstruct or approximate any other mark.
- **Emoji are not iconography** here — see Content Fundamentals.

---

## Index

### Root
| File | What |
| --- | --- |
| `styles.css` | The entry point consumers link. `@import` lines only. |
| `tokens/colors.css` | Palette + semantic aliases |
| `tokens/typography.css` | Both families and every type step |
| `tokens/spacing.css` | Page, column, and fixed component dimensions |
| `tokens/effects.css` | The rule-weight ladder, state tokens, timings |
| `tokens/fonts.css` | IBM Plex Mono from Google Fonts (Helvetica Neue is the system stack) |
| `tokens/base.css` | Body reset, link colours, radius-0 |
| `thumbnail.html` | The homepage tile |
| `SKILL.md` | Agent-Skills front matter for use in Claude Code |
| `github.md` | Source-repo association for one-click sync |

### Components — `components/<group>/`
Exactly the inventory `src/components/` defines; nothing invented.

- **chassis/** — `Unit` · `Masthead` · `Bay` · `Silk` · `Readout` · `Ticker` · `Stamp`
- **controls/** — `Button` · `Knob` · `Scrubber` · `Kbd`
- **pads/** — `Pad` · `KeyPlate`
- **sequencer/** — `StepGrid`
- **stage/** — `StageKey` · `ArrowKey` · `CommentCards` · `Backdrop`
- **remix/** — `RemixPanel` (plus `MAX_WORDS`, `wordCount`)
- **broadcast/** — `Monitor`

Each directory carries `<Name>.jsx`, `<Name>.d.ts`, `<Name>.prompt.md` and one `@dsCard` specimen HTML.

**Intentional additions:** none. Two components are **cosmetic recreations** rather than ports, because the
originals are canvas engines rather than UI: `Monitor` (the product's live 1080×1080 canvas, rebuilt as DOM with
the same vocabulary) and `Backdrop` (the product's ASCII-field + focus-ramp + grain canvas, rebuilt as a
lighter glyph field). `CommentCards` takes a plain `comment` object where the product passes a mutable
state ref driven by its animation loop.

### Foundations — `guidelines/` (24 cards)
**Colors** paper/white/ink · corporate blue · muted ink & hairlines · on blue ·
**Type** display headline · section heads · dek & body · the house label · IBM Plex Mono · index numerals ·
**Rules & Depth** the rule weight ladder · hairlines & dotted rules · corners & shadows ·
**Spacing** page & column grid · component metrics ·
**Brand** mastheads & form numbers · rubber-stamp seals · the ticker · button states · the glyph set ·
redaction marks · footers · **Imagery** the image library · generated marks.

### UI kits — `ui_kits/<product>/`
| Kit | Screens |
| --- | --- |
| `circleback/` | The stage (blue room, monitor, arrows, faders) and the studio (phrase index, key plate, registers, sequencer, export rack) |
| `lessons/` | Home (six doors) → interview → result with the LinkedInification dial and diagnostics |
| `roast/` | The inspection form → the verdict, the redemption and the roast card |
| `museum/` | Wing I the collection · Wing II the Redaction Office · Wing III the Historical Archive |

Each kit has its own `README.md` listing exactly what is faithful and what is a cosmetic stand-in.

### Assets — `assets/`
`marks/` generated favicons and app icons (4 products) · `social/` the four 1200×630 OG cards ·
`library/` five plates from the 47-plate image library.

---

## Substitutions & gaps — read before you build

1. **No font binaries were provided.** Helvetica Neue is the system stack (present on macOS/iOS, absent on
   Windows and Android, where Arial takes over — expect slightly wider setting there). IBM Plex Mono loads
   from Google Fonts, exactly as the product does. **If licensed Helvetica Neue web fonts exist, drop the
   files in and add the `@font-face` rules to `tokens/fonts.css`.**
2. **No logo file exists.** The wordmark is plain type everywhere, per the handoff. Nothing was drawn.
3. **The audio engine is out of scope.** `src/audio.js`, `song.js`, `randomizer.js`, `exporter.js` and
   `remix.js` are the product's real logic (WebAudio synthesis, a 25ms lookahead scheduler, a WebCodecs mp4
   pipeline). The UI kits fake the transport with `setInterval`. Port from the repo if you need the real thing.
4. **Six of twelve museum exhibits** and **seven of twenty-seven roast findings** are included as samples;
   the full banks are in the repo.
