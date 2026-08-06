# Handoff: LinkedIn Beats — Homepage, Barry's Office (Roast/Rewrite/Create) & About

## Overview
A satirical-but-useful marketing site for **LinkedIn Beats** (the umbrella brand over Circle Back®, LinkedIn Lessons™, Roast My LinkedIn™ and the Museum of Professional Communication). This handoff covers:

1. **The homepage** — "The Loud Filing": a playful, virality-oriented layout executed strictly in the Circle Back design-system palette
2. **Barry's Office** (`Roast.dc.html`) — a three-mode tool page: Roast / Rewrite / Create, running fully client-side
3. **About** (Form LB-02) and the **Company Store** (copied from the design-system template)

Source repo for the live product: `github.com/aphelps099/linkedin` (branch `main`). Barry mascot art and the roast engine copy are taken from it verbatim.

## About the Design Files
The files in this bundle are **design references created in HTML** — working prototypes that show intended look and behavior. They are NOT production code to copy directly. The task is to **recreate these designs in the target codebase's environment** (the live product is a React/Vite app — follow its established patterns in `src/`), reusing its existing components (`src/components/…`) and tokens (`src/tokens/*.css`) wherever they exist.

## Fidelity
**High-fidelity.** Colors, type, spacing, borders, shadows, copy and interactions are final and should be recreated pixel-perfectly. All copy is deliberate — reproduce it exactly, including capitalization and punctuation (`·` separators, `—` verdict dashes).

## Design Tokens
The Circle Back system (see `src/tokens/` in the repo), plus the homepage "campaign voice" extensions:

- `--paper: #f6f5f1` page background · `--white: #ffffff` cards
- `--ink: #111111` ALL text, rules, borders · `--ink-40: #11111166` muted · `--hair: #11111122` hairlines/dotted
- `--blue: #0a66c2` headlines, fills, active states · `--blue-light: #9fc8ea` readouts on blue
- **Campaign extensions (this site only):** deep navy `#084d92` (ticker, beats stage, final CTA), manila `#ecd7a4` (accent chips, button second-cells, product tiles)
- Type: `"Helvetica Neue", Helvetica, Arial, sans-serif` for everything; `"IBM Plex Mono"` (Google Fonts) for form numbers, readouts, machine text — never prose
- House label: 9.5px / 700 / .16em tracking / uppercase
- Rules ladder: 3px masthead+footer · 2px section rules · 1.5px cards/buttons · 1px dotted `#11111122` list rows
- **Campaign depth (bends the base system):** flat offset ink shadows (`box-shadow: NpxNpx 0 #111`, N = 3–16), slight rotations (−4°…+1°), border-radius 0 everywhere EXCEPT the iPod device (30px body, 8px screen, 50% wheel)
- Motion: `cbBlink` 1s step-end cursor blink; `cbRise` .38s cubic-bezier(.2,.8,.3,1) fade-up 10px; `cbMarquee` 28s linear ticker; `cbSpin` 16s record; `cbEq` alternating equalizer bars (play-state paused unless playing). No other animation.

## Screens / Views

### 1. Homepage (`LinkedIn Beats Homepage.dc.html`, 1180–1440px, ink side borders)
Sections top to bottom:
- **Masthead** (3px bottom rule): wordmark "LinkedIn **Beats**▮" — "Beats" is a white-on-blue chip rotated −2°, cursor ▮ always blue; center nav (house label style): The Beats / Your Wrapped / Bingo / Merch / About; right: "ROAST ME `R`" blue button, 4px offset shadow → links to Barry's Office
- **Hero** (grid `minmax(0,1.02fr) minmax(0,.98fr)`): left — BULLETIN chip + 70px/.88 headline "The soundtrack of {rotating claim}▮ professionals." Claim rotates every 2.2s among: deeply humbled / beyond excited / truly honored / very thrilled; claim sits in a FIXED 74px line box (nowrap) so rotation never reflows; blue with blinking cursor. CTAs: split button "ROAST MY LINKEDIN | IT'S FREE →" (blue+white cells, 6px shadow) and outline "SEND TO A COWORKER ↗" (copies intervention message to clipboard, shows mono `✓ COPIED — CLEARED FOR THE FEED` for 2.6s). Microcopy mono: `NO LOGIN · NO COACHING FUNNEL · MILD EMOTIONAL DAMAGE`. Right — royal-blue panel (1.5px left rule) with dot texture (radial-gradient ink dots 14px grid), containing an `<image-slot>` (id `hero-record`) for a photo (record player on a conference table); until filled, a CSS-drawn spinning record (16s linear, white/blue-light grooves, 3px ink border, 14px offset shadow, blue center label "NOW PLAYING / SYNERGY IN B2B MINOR / 2:47 · FEAT. THE ALGORITHM") plus a white instruction chip; rotated stickers "#OPEN TO WORK" (white/blue, −12°) and "Q3 BANGER" (manila circle, +9°); caption "It has thoughts. None are its own."
- **Marquee ticker**: navy `#084d92`, 56px, white 18px/700 uppercase clichés separated by blue-light ▮, translateX(−50%) loop 28s
- **Drop a beat** (navy + tiled ASCII glyph texture `assets/ascii-field.png` — glyphs `·—▮▯|/\=+:` at 22% white, 570px seamless tile): white 84px/.8 heading "Drop a beat. Cite your sources." Two-piece rig:
  - **Corporate iPod "MODEL LB-01"** (370px): paper body 3px ink border, 30px radius, 10px offset shadow; navy screen (2px ink, 8px radius) with mono header `NOW PLAYING · n OF 5` + play glyph + time; track title 17px/700; progress bar (blue-light on 22% white); 5-track menu (selected = white row, navy text; rows: Synergy in B2B Minor 2:47 / Let That Sink In (Remix) 3:12 / Per My Last Email 2:58 / Thrilled to Announce 2:31 / We Are a Family (Live) 4:04); bottom teletype line `ON THE RECORD · "{last struck phrase}"▮`; click wheel 216px (2.5px ink circle): MENU label top, ◀◀/▶▶ prev-next, center 76px circle button CONVENE/ADJOURN (latches blue when playing); caption `CORPORATE LISTENING DEVICE · MODEL LB-01 / DO NOT OPERATE DURING ALL-HANDS`
  - **CB-16 chassis** (3px ink, 16px offset shadow, −.3° rotation): header rack = nameplate "Circle Back® CB-16" | black readout strip (mono blue-light `THE INSTRUMENT REPORTS TO THE DEVICE. STRIKE A KEY.`) | `CAL. A · 112 BPM`; "The keys" bay = the product's KeyPlate/Pad 4×4 (16 phrase pads, hotkeys `1234QWETASDFZXCV`, 130ms blue flash on strike); "The minutes" bay = StepGrid sequencer (Kick/Snare/Hat + Vox row printing 2-letter phrase codes, 16 steps, click cycles/drag paints, playhead = inset 2px blue-light frame walking at 134ms/step while playing); footer rail: browser reassurance + "Open the full studio →"
- **Daily Beat** (grid 130px | 1fr | 230px): vertical ink label THE DAILY BEAT; middle on ruled-ledger lines (27px repeating hairline): kicker BUSINESS, 50px/.95 headline "Local man announces promotion with the bravery of a wartime correspondent.", quote line; right manila stat cell with dot texture: 54px "14,208 / IMPRESSIONS / 3 people read it"
- **Wrapped** (royal blue + white halftone dots): 84px white heading "You posted. The algorithm endured."; floating mode tabs (Founder/AI expert/Recruiter — selected blue, 3px shadows, overlap card by −2px); the card: paper, 3px ink, 14px shadow, −.4° rotation; mono header row `LINKEDIN BEATS — WRAPPED | JAN—DEC 2026`; manila title band (label YOUR UNOFFICIAL TITLE + 72px/.86 title); 4-col stat grid (2px ink column rules): blue 68px numerals; per-persona data: Founder = Chief Executive Storyteller / 247 / 96% / 1,108 / "journey"; AI expert = Prompt Visionary / 611 / 12% / 4,392 / "agents"; Recruiter = People Person Person / 384 / 83% / 2,019 / "rockstar"; footer row: `TOP 0.4% OF PEOPLE WHO SAID "AUTHENTIC"` + ink SHARE MY RESULTS ↗ (copies)
- **Cringe Bingo** (split): left ink panel with diagonal hatch — 110px/.74 "LINKEDIN CRINGE BINGO." (CRINGE in blue-light) + white-outline "CLEAR THE EVIDENCE ×"; right blue-light panel with ink dots — bingo card (3px ink, 12px shadow, +1° rotation, manila FREE SPACE header: "I asked AI to make this sound human."), 4×4 grid (1px ink gutters), cells toggle: checked = blue fill/white text + giant 58px blue-light ✓ watermark rotated −14° behind label; hover = blue-light; SHARE MY CARD `n/16` ↗ button below (copies). Left panel also holds **"Score someone's post ▸"**: a white-framed intake (textarea) → "Run the detection ▸" regex-matches the 16 phrases against the pasted post and marks the live grid → "Download comment card ↓" renders a 1080×1080 PNG (paper, ruled 4×4 grid, hits in blue with ✓ watermark, footer `n/16 OBSERVED · LINKEDINBEATS.COM`, blue VERIFIED — BD-16 stamp) + "Copy the caption" — the card is designed to be attached as a LinkedIn comment image on the offending post
- **Roast interlude** (manila + diagonal hatch, 2px rules): **Barry** (`public/barry/barry.png`, 76px, `image-rendering:pixelated`, −4°) | kicker BARRY (COMPLIANCE) HAS REVIEWED YOUR WORK + 48px "He would like to see you in his office." | blue "GET YOUR ROAST RECEIPT →" (6px shadow) → Barry's Office
- **Merch** (paper): 104px/.78 "Wear your boundaries."; right column copy + manila "SHOP CAREER APPAREL ↗" button (4px shadow) → store; 3 product cards (2px ink, 7px shadows, blue ADD TO CAREER CART + footer): tee (blue-light halftone tile, ink tee silhouette via clip-path, "DEEPLY HUMBLED" white rotated −3°, $32) / cap (royal tile, $28) / tote (manila tile, "PER MY LAST EMAIL", $24) — all link to the store
- **Final CTA** (navy + dots, giant blue-light ↗ glyphs at 20% rotated ±): "Stage a professional intervention." 112px/.78 white + white SEND TO A COWORKER button (8px shadow); "Anonymous-ish. Loving-ish. Extremely shareable."
- **Footer** (3px top rule): wordmark · disclaimer "We make professional networking slightly less professional. Not affiliated with your network." · rubber Stamp "HUMBLED — ALLEGEDLY" (−5°, ink)

### 2. Barry's Office (`Roast.dc.html`)
- **Masthead** as homepage (back link, store, About; mono `Form RM-1 · Rev. 2026-08`)
- **White hero**: kicker `THE OFFICE OF BARRY · COMPLAINTS PROCESSED LOCALLY`; blue 76px/.84 "Barry will see you now."; dek with blue bold reassurance; **three mode cards** (name 13px caps + mono sub, 4px shadows, selected = blue): Roast `"84% CEREMONIAL GRATITUDE."` / Rewrite `SAME FACTS. DIFFERENT ENERGY.` / Create `ARRIVE WITH NOTHING.`; right: **Barry** `public/barry/barry-flagged-brand.png` (260px, pixelated — bubble recolored to brand blue #0a66c2) + mono caption `BARRY · CHIEF INSPECTOR / HE HAS SEEN YOUR DRAFTS`
- **Roast mode** — Form RM-1 card (3px ink, 14px shadow): Section 1 what are we inspecting (My post / My headline / My About; sample specimen preloads and swaps until user edits); textarea (1.5px ink, paper fill); Section 2 inspector (McKinsey Partner / Burned-Out Recruiter / Gen-Z Intern / The Algorithm, tagline in blue mono below); Section 3 intensity (1 Gentle Feedback → 4 HR Violation; level 4 latches INK not blue; blurb below); "FILE THE COMPLAINT | NO MERCY →" split button (manila second cell); footer mono `BY CONTINUING YOU AGREE TO BE PERCEIVED.`
  **Verdict state**: blue-framed verdict panel (persona opener italic → findings as `→` dotted rows → closer; meta `INDEX n · rank`); redemption panel with Copy + blue "POST IT TO LINKEDIN →"; right column: 1080×1080 roast card (blue, 3px ink, 10px shadow, −.6°: wordmark/FORM RM-1 header over 3px white rule, giant index + rank + `THOUGHT LEADERSHIP INDEX · 0—100`, top-4 findings, footer persona · intensity + white ROASTED — OFFICIAL box rotated −4°); buttons: manila "DOWNLOAD CARD ↓" (renders a real 1080×1080 PNG via canvas) and "POST MY VERDICT →"; "Re-roast ×"; "Turn the original into a beat ♫"
- **Rewrite mode** — Form RW-2: textarea + treatments (Humanize it / Shorten it / Fix the hook / Maximum corporate — the last latches ink); "FILE FOR REWRITE | SAME FACTS →"; output panel (blue frame, rises in) with Copy / Post it to LinkedIn → / Roast it → (pipes result into Roast mode)
- **Create mode** — Form CR-3: 6 categories (Hiring / Announcement / Insight / AI FOMO / Sales / Promotion), three labeled blanks per category (specimen placeholders used when empty), LinkedInification level 1 · Almost Human → 4 · Corporate Hallucination (4 latches ink); output panel with the same three actions
- **Footer**: disclaimer "Roast My LinkedIn™ is not affiliated with your network. Every roast ends in redemption." + Stamp ROASTED — OFFICIAL

### 3. About (`About.dc.html`, Form LB-02)
1120px measure on paper. Sections: "About the department." (blue 64px) + two paragraphs; **The record** (dotted rows, mono values: FOUNDED 2026 · DURING A MEETING THAT COULD HAVE BEEN AN EMAIL / HEADCOUNT 1 · CROSS-FUNCTIONAL / DATA COLLECTED 0 BYTES / QUALIFIED LEADS 312% MORE, ALLEGEDLY / AFFILIATION NONE); **The instruments** (2×2 door cards, hover inverts to ink, linking to the four live tools); **Frequently filed questions** (3 Q&As); footer + APPROVED — HR stamp.

### 4. Company Store (`store/CompanyStore.dc.html`)
Copied from the design-system template `The Company Store` (Form CS-1) — storefront grid, product detail drawer, order form. Linked from homepage merch + mastheads.

## Interactions & Behavior
- Rotating hero claim: 2.2s interval, fixed line box (no reflow); tweakable (rotateClaims boolean, claimSeconds 1–6s)
- Clipboard shares (coworker/wrapped/bingo): `navigator.clipboard.writeText`, 2.6s mono confirmation
- Beats transport: interval 134ms advances 16-step position; playhead only while playing; equalizer bars `animation-play-state` toggles; pad strike = 130ms hot flash + updates ON THE RECORD readout
- LinkedIn posting (no API): open `https://www.linkedin.com/feed/?shareActive=true&text=<urlencoded>` in a new tab — pre-fills the composer; the roast card PNG is attached manually by the user
- Roast engine: deterministic, client-side (`roast-data.js`, verbatim from repo `src/roast/`): findings detection by regex, persona × intensity voice matrix (intensity 1–2 mild / 3–4 savage; line count 2/4/5/7), Thought Leadership Index scorer, redemption generator
- Rewrite transforms (client-side, in the prototype's logic class — port as pure functions): humanize (strip emoji/hashtags/engagement bait; buzzword→plain map; merge dramatic one-word lines), shorten (humanize → first 2 + last sentence), hook fix (promote first sentence containing a digit or "I…" to the top), maximum corporate (plain→buzz map, sentence-per-paragraph, "Read that again." insert, bait + hashtags + rockets appended)
- Create: category template + fields → base post; level 1 = humanized, 2 = as written, 3–4 = corporate transform (4 = extreme)
- Hero image slot: drag-and-drop photo persists; drawn record + instruction chip hide when filled (poll of the slot-state sidecar)
- Hovers: invert to solid ink everywhere (buttons, rows, doors); no dimming, scaling, or lifting

## State Management
Homepage: `claimIdx`, bingo `checkedC[16]`, wrapped `persona`, beats `{playing, pos, pattern[4][16], trackIdx, padHot, lastPhrase, selRow}`, `copied`, `heroFilled`.
Barry's Office: `mode (roast|rewrite|create)`, roast `{stage, kind, personaId, intensity, text, edited, result}`, rewrite `{rwKind, rwOut}`, create `{cat, crLevel, f1–f3, crOut}`, `copied`. No persistence required except the hero image slot; no server anywhere.

## Assets
- `public/barry/*.png` — official Barry pixel set from the repo (plain, 48px, coo/noted/flagged/policy/circle-back/per-my-last speech bubbles) + two derived variants made here: `barry-flagged-brand.png` (bubble recolored #0a66c2 — used in Barry's Office hero), `barry-flagged-navy.png` (white outline + DOS-grey bubble, for navy backgrounds). Always render pixelated.
- `assets/ascii-field.png` — 760px seamless glyph-field tile (Backdrop vocabulary) for navy sections; the live product draws this live on canvas (`src` Backdrop) — prefer the live canvas in production
- `assets/profile-300x300.png` — LinkedIn page avatar (used in the reconstructed feed ad in the exploration file)
- Hero photo: intentionally an empty slot; art direction = flash-lit corporate stock, record player on a conference table, motivational posters behind

## Files
- `LinkedIn Beats Homepage.dc.html` — the homepage (single source of truth)
- `Roast.dc.html` — Barry's Office (three modes)
- `About.dc.html`, `store/CompanyStore.dc.html` + `store/*` — supporting pages
- `roast-data.js` — roast engine data + scorer (port target: reuse repo `src/roast/` directly)
- `export/linkedin-beats-homepage.html` — self-contained offline bundle of an earlier homepage revision
- `Homepage Directions.dc.html` — the exploration canvas (directions 1a/1b/2a/3a + player explorations 4a/4b); reference only, not for implementation

## Notes for the implementer
- The live product is the ground truth for engine logic (`src/roast/`, `src/audio.js` etc.) — the prototypes fake the transport with `setInterval`; wire the real WebAudio engine for sound
- Keep the privacy promise literal: no accounts, no telemetry, all generation in-browser; the "Post to LinkedIn" flow is a URL intent, not an API integration
- The base design system forbids shadows/rotations/marquees; this site's "campaign voice" deliberately bends those rules as documented above — do not "correct" them
