# Circle Back® — The Professional Phrase Organ

A satirical LinkedIn audio mixer: a 16-key phrase sampler that speaks corporate
clichés ("Humbled and honored to share", "Let's circle back", "Full stop.")
in time over a live-synthesized WebAudio drum machine — now with an upload
sampler and a clip exporter for your feed. Form CB-16 · Rev. 2026-08 ·
For internal thought leadership only.

See [ROADMAP.md](ROADMAP.md) for the current Now / Next / Later product plan,
including Dynamic Voice v2, the Museum gallery prototype, export reliability,
and the serious grader direction.

Built from the design handoff in `design_handoff_circle_back_mixer/` —
Swiss International Style played dead straight as corporate bureaucracy.

## Run it

```sh
npm install
npm run dev
```

Then open the printed local URL. `npm run build` produces a static bundle in
`dist/` with relative paths, so it also serves from GitHub Pages —
`.github/workflows/deploy.yml` deploys `main` to Pages automatically
(enable Pages → Source: GitHub Actions in the repo settings, or trigger the
workflow manually from the Actions tab).

The build is multi-page: the LinkedIn Beats homepage at `/`, the mixer at `/studio/`, **LinkedIn Lessons™** at
`/lessons/`, **Roast My LinkedIn™** at `/roast/`, **The Museum of
Professional Communication** at `/museum/`, **The Company Store** at
`/store/`, and the **LinkedIn Beats** umbrella homepage at `/v2/`.

## Previous homepage design (archived source)

The section below documents the earlier `src/v2/V2.jsx` concept. The current `/` and `/v2/` entry points use `src/home/Homepage.jsx`; see **Corporate pop homepage** below.

The future home of LinkedIn Beats — the umbrella brand over the mixer,
Lessons, Roast, the Museum and the Store — recreated from the handoff in
`design_handoff_linkedin_beats_site/` and served at `/v2/` (visiting `/v2`
301-redirects to it). "The Loud Filing": a rotating hero, a marquee of
clichés, the **Drop a beat** rig (a corporate iPod driving the real CB-16
phrase organ — it reuses the mixer's `Pad`/`KeyPlate`/`StepGrid`
components), a Daily Beat splash, a persona-switching **Wrapped** card,
**Cringe Bingo** (paste a post → regex detection → a downloadable 1080×1080
comment card), a Barry interlude, a merch strip, and a final CTA. Pure
client-side, no accounts, no telemetry; clipboard shares and a canvas PNG
are the only outputs. Cross-links point at the live tools (`../roast/`,
`../store/`, `../` for the studio). The campaign voice deliberately bends
the base system (offset ink shadows, slight rotations, one marquee) — that
is intended, not drift.

### The Corporate Phrasebook (previous design audio)

The rig on `/v2/` is the real instrument, not a mockup: **CONVENE** starts the
WebAudio kit playing the sequencer grid (`src/audio.js`, the same engine the
studio uses), and the Vox row speaks from the recorded phrase bank.

**Striking a key runs a lesson** — the page teaches you the phrase in the
cadence of a language tape that has been through a compliance review:

```
"Let's say"   →  the phrase, in the recorded library voice
~ the beat arrives ~
                 the phrase, on the downbeat, two or three times
"Just say"    →  the phrase
"Remember"    →  the phrase  →  everything phases and decays out
```

The instructional cues are the browser's own speech voice; the phrase is
always the recorded bank, so the two speakers never blur. Because every clip
is a different length (0.5s to 2.7s against a 2.14s bar at 112 BPM), the
lesson is laid out in **bars, not seconds**: one utterance claims however many
whole bars it needs, short phrases drill three times and long ones twice, and
the arc above is identical for all 57 clips. `planLesson()` in
`src/v2/lesson.js` is pure and pinned by `npm run check:lesson`, which
verifies the arc against every real clip's duration.

Clips are fetched on demand (the full bank is 9MB — far too much to hand a
marketing page up front). The sixteen keys are wired to bank indices, so each
key only carries a phrase the library voice can genuinely say. Barry walks on
from the left when the beat starts and bobs on the kick.

## The Company Store (`/store/`)

*The Circle Back® ecosystem · Merchandise division* — Form CS-1, at `/store/`.
Nine SKUs across Shirts, Hats, Stickers and Posters, built from the design
handoff in `design_handoff_company_store/`: a filterable product grid with ink
grid lines, a product detail panel, and an order drawer. Hover inverts to
solid ink; nothing dims, scales or lifts; all sales final.

The order form persists in `localStorage`. **Submit the order** posts the cart
(SKUs and quantities only — the server prices everything from the catalog in
`src/store/products.js`) to `/api/checkout`, which creates a **Stripe Checkout
Session** and redirects; returning lands back on `/store/` as
`?order=filed` or `?order=tabled`, in voice. Free shipping over $50 is applied
server-side as a $0 shipping rate at a $50 subtotal.

Fulfilment is **Printify**: on the `checkout.session.completed` webhook
(`/api/store/webhook`, signature-verified), the server creates a Printify
order addressed from the Stripe session and submits it to production. Railway
service variables:

- `STRIPE_SECRET_KEY` — enables checkout (`/api/health` reports
  `checkoutConfigured`).
- `STRIPE_WEBHOOK_SECRET` — the webhook's signing secret.
- `PRINTIFY_API_KEY`, `PRINTIFY_SHOP_ID` — the shop that prints the goods.
- `PRINTIFY_SKU_MAP` — JSON mapping local SKUs to Printify products, e.g.
  `{"CS-101":{"productId":"…","variants":{"S":1,"M":2,"L":3,"XL":4}},"CS-301":{"productId":"…","variantId":5}}`.
  Orders with unmapped SKUs are left in Stripe and logged, never guessed.
- `STORE_FLAT_SHIPPING_CENTS` (default `500`), `STORE_SHIP_COUNTRIES`
  (default `US,CA,GB,AU`), `STORE_PUBLIC_ORIGIN` (defaults to the request
  origin) — optional tuning.

Without the Stripe key the storefront still runs; submitting reports
"Checkout is not yet configured. The order was tabled." Product photography
lives in `public/store/`, and the store's social card (`store-og.png` — the
CS-1 masthead beside a turntable spinning in a conference room) is composed
by the same script; regenerate both with `node scripts/make-store-assets.mjs`.
Engine checks: `node scripts/check-store.mjs`.

## The Museum of Professional Communication (`/museum/`)

*Authors anonymized. Clichés immortal.* The current experience opens in a
curated 2.5D **Hall of Humble Brags** on desktop and an accessible exhibit list
on mobile or reduced-motion devices. Select any framed work to open its
inspection plaque, Thought Leadership Index, and handoffs to Roast or the
mixer. The Museum then continues into three institutional functions:

- **The Collection** — twelve curated exhibits, every one synthetic: fiction
  written in the style of the genre it commemorates, displayed as redacted
  documents with curator plaques, inspector quotes, and a live Thought
  Leadership Index. Each exhibit can be sent to Roast or performed as a beat.
- **The Redaction Office** — the submission door. Paste a post and it is
  anonymized *in the browser, before anything is sent anywhere*: names,
  companies, handles, emails, links, and impressive numbers become
  placeholders (`[ANONYMOUS VISIONARY]`, `[REDACTED FORTUNE 500 COMPANY]`,
  `[IMPRESSIVE SUM]`). The preview is exactly what would be submitted;
  submitting opens a curated review (a GitHub issue) — nothing publishes
  automatically. The genre goes on the wall. The person does not.
- **The Historical Archive** — a placard history of the professional
  internet, from the 2003 founding through the broetry period, the weeping
  executive, and the delve era. The events are real; the tone is a museum's.

Engine checks: `node scripts/check-museum.mjs` (redaction leak tests,
determinism, exhibit completeness).

## Roast My LinkedIn™ (the inspection office)

*Present your personal brand for inspection*, at `/roast/`. Paste a post, a
headline, or an About section and choose your inspector and your fate:

- **Four personas**, each with a mild and a savage register: The McKinsey
  Partner, The Burned-Out Recruiter, The Gen-Z Intern, and The Algorithm.
  Switching personas re-reads the same findings in a new voice, live.
- **Four intensities**: Gentle Feedback → Peer Review → Performance Review →
  HR Violation.
- **27 findings** across the three input kinds — journey counts, humble
  brags, pipe-separated identity crises, "Top Voice" badges, third-person
  bios, "passionate about", and the rest of the genre.
- **The roast card** — a 1080×1080 canvas verdict (score, rank, top lines,
  the ROASTED — OFFICIAL stamp) rendered in the browser and downloadable,
  sized for the feed that caused this.
- **Redemption**: every roast ends with the version you should actually use
  (the Lessons humanizer for posts and bios; a de-inflated rewrite for
  headlines). Posts can also go straight to the mixer as a beat.

Engine checks: `node scripts/check-roast.mjs`.

## LinkedIn Lessons™ (the post generator)

*What are we pretending to be humbled about today?* — a guided post generator
disguised as satire, at `/lessons/`. Create a better LinkedIn post, or make it
dramatically worse.

Lessons is a **complementary toolset that stands on its own** — it is not a
mod of the mixer. Circle Back's screens, keys, and flow are untouched; the
only connection is a one-way door (below) that Lessons can send a finished
post through.

- **Six doors**: Announce Something, Teach a Lesson, Sell Without Selling,
  Manufacture Urgency, AI Thought Leadership — and Roast My LinkedIn, which
  leads out to its own tool at `/roast/`.
- **A Mad Libs interview** — one question at a time, and the form talks back
  ("Excellent. Let's make Sarah's employment feel historically significant.").
- **The LinkedInification dial** — five levels, from **1 · Almost Human**
  (clear, useful, genuinely publishable) to **5 · Corporate Hallucination**
  (an ordinary Tuesday becomes a transformational moment for the global
  business community). Same seed, same facts: the dial escalates the *same*
  post, and the Thought Leadership Index never goes down when the dial goes up.
- **The result page** shows the post in a LinkedIn-style preview with
  diagnostics — humble-brag score, buzzword density, gratitude inflation,
  dramatic one-liners, journey references, and the probability someone
  comments "Well deserved!" — plus Copy, Make It Worse, Make It Human,
  Add More Synergy, Add a Personal Struggle, Founder Voice, and Roast This
  Post.
- **Turn It Into a Beat** — the one-way door. Lessons hands the finished
  post to the mixer via a `#beat=` URL hash; Circle Back opens with the
  remix panel staged and the post already analyzed, one press away from
  becoming a track. Arrive without the hash and the mixer behaves exactly
  as it always has.

Everything is template-driven and seeded (`src/lessons/generator.js`) —
no network, nothing leaves the browser.

## Post-specific remix voice

The mixer generates a four-act performance with OpenAI `gpt-4o-mini-tts`, so
names, products, acronyms, and numbers become spoken material instead of
display-only copy. Three lines use a polished corporate announcer; a vintage
1980s compliance mainframe interrupts for the final filing. The four requests
run independently, and playback can begin as soon as line one is ready while
the remaining filings arrive. Play and Export reuse the same decoded takes.

The full pasted post is still analyzed locally; only four short performance
lines are sent for speech generation. If a request fails, the browser's native
speech voice performs the same selected line. The stage never replaces the
author's words with an unrelated archive phrase.

Production on Railway builds the Vite application and starts the Express
server in `server/index.js`. Add `OPENAI_API_KEY` and `ELEVENLABS_API_KEY` as
Railway service variables. `ELEVENLABS_VOICE_ID` is optional and defaults to
the Circle Back lady; the server owns `/api/voice`, while all other routes
serve the application.
`/api/health` reports whether voice is configured without exposing the key.
The included `railway.json` supplies the build, start, and health-check settings.

The Cloudflare Worker in `worker/` remains available as an alternative voice
endpoint:

```sh
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put ELEVENLABS_API_KEY
npx wrangler deploy
```

Set `VITE_VOICE_API_URL` at build time only if the Worker is deployed on a
separate origin. For the default Railway deployment, no client configuration
is required. The API key belongs only in a server-side secret store and must
never be exposed through a `VITE_` variable or committed to GitHub.

## The stage

The app opens as a blue room: the broadcast fills the screen, and there are
**three keys**. That's the instrument.

| Key | Does |
| --- | --- |
| **Phrase** (`1` / `A`) | Says the next line of the track's setlist, quantized to the next 16th so it always lands on the grid |
| **Build** (`2` / `S`) | Raises the room — filter ducks then opens over three beats, arps enter, hats double, a riser climbs, snares roll |
| **Drop** (`3` / `D`) | Slams the filter open with an impact hit, chord stabs and sub arrive, and the hook phrase fires. Settles back to the groove after two bars |

`Space` plays/pauses · `R` generates a whole new track · **Audio tools** opens
the studio for anyone who wants to program it by hand.

Two scrubbers sit under the keys:

- **Weirdness** — ring modulation, bitcrush, wobble and delay feedback, all on
  one fader. At zero it's a person; at one it's the machine that replaced them.
- **Distortion** — how hard the phrase bus is driven.

The button beside them cycles the **corporate distortions**: *Boardroom*
(clean presence), *Conference call* (telephone band), *All-hands PA*
(megaphone), *Reply-all* (metallic, heavy feedback), *Bandwidth* (everything
below 2.2 kHz, nothing above).

Phrases are placed with the room they need: the randomizer measures each
recorded line's real duration at the current tempo and delivery rate, then
refuses to schedule the next phrase until the current one has finished
speaking, plus a half-beat to breathe.

## The band

Every track is produced before you touch anything. `src/song.js` picks a key,
a chord progression (i–VI–III–VII, i–VII–VI–V, i–iv–VI–V, or a major
discotheque turn), a bassline rhythm, an arpeggio direction, chord-stab
placement, and a phrase setlist. The bass plays from the first bar; arps and
computer blips arrive on the build; stabs and sub-bass land on the drop. All
of it is synthesized live — no samples — through a master filter the
performance keys sweep, with the spoken phrases running through a drive +
dotted-eighth delay bus.

- **Keys** — every pad shows its keyboard letter (`1234` `qwet` `asdf` `zxcv`);
  type it (or click/tap) to speak the phrase and arm it. The **phrase index**
  carries the full 37-phrase bank — the 16 keys plus an extended reserve
  ("Most people won't understand this. But you will.", "Hot take: teamwork
  makes a difference.", "Onwards and upwards! 🚀") reachable by click and
  drawn on by the randomizer.
- **Space** plays/pauses. **Shift+↑/↓** drives Delivery; **Shift+←/→** drives Sincerity.
- **Double-click a track name** in the sequencer to clear that track.
- **Sequencer**: click drum cells to cycle off → hit (blue) → accent (ink); click Vox
  cells to stamp the armed phrase's two-letter code; drag paints. **Steps 16/32/48**
  set the meeting length (default 32) — longer meetings give long phrases room to
  finish before the next one lands; extending tiles the current pattern.
- **Exhibits (the sampler)**: *Submit exhibit* uploads audio files (up to five).
  Each is admitted into the record as its own sequencer row — cells cycle
  hit/accent like drums. `▸` auditions an exhibit, `×` strikes it.
- **Minute-take** records: while playing, pressed keys are stamped into the Vox row
  at the current step.
- **Registers**: drag dials vertically (Shift = fine, double-click = reset,
  wheel = ±3%). Sincerity and Delivery shape the spoken voice; **Decay** governs
  what happens to the previous phrase when a new one lands — low chokes it
  instantly, high lets it ring out in full; Tempo is 60–200 BPM.
- **Load agenda** seeds a demo pattern; **Table it** clears the grid.
- **Reorg** (`R`) calls a restructuring: a fresh musical drum pattern in a random
  meeting cadence (All-hands, Offsite, Sprint review, Town hall), sparse hits for
  your exhibits, and three-to-five phrases booked into the Vox row with breathing
  room. Synergies are realized immediately.
- **The engagement engine**: while the meeting is convened, reactions tick up,
  reposts accrue, and fake comments from the network's finest (Chad Growthman,
  VP of Vibes · Brenda Synergy, Chief People Officer) roll into the broadcast
  monitor. Every convene is a fresh post; the numbers build from zero.

## Distribution (posting to LinkedIn)

The **Distribution** bay shows the broadcast monitor: corporate blue field,
white text, white-outlined squares with white fills marking the beats in
sequence, and the triggered phrase revealed with a teletype animation —
rendered live on a 1080×1080 canvas. While taping, the monitor becomes a
director and cuts between closeup scenes: **the phrase** (big type +
engagement counters), **the pads** (the 4×4 key plate), **the cadence**
(the full beat grid), and **the comments** (the fake feed arriving in real
time). **Cut a clip** tapes it plus the master audio bus for the chosen run
of show (4/8/12 loops — ≈10/20/30s at 96 BPM, one scene per quarter) and
downloads a square video sized for a LinkedIn post; **Export audio** downloads
just the mix. The monitor also carries a live equalizer off the master bus —
in the composite view and as its own scene.

Video export uses WebCodecs + mp4-muxer to produce a real **H.264 + AAC
`thought-leadership.mp4`** (what LinkedIn, X, QuickTime, and phones expect)
wherever the browser supports those encoders (desktop Chrome/Edge); elsewhere
it falls back to MediaRecorder's best available format (usually `.webm`).
Upload the file to your feed. Tag someone who needs to hear this.

The 16 phrases ship as recorded voice lines (`public/phrases/*.wav`,
generated text-to-speech) played through WebAudio so they land in exports;
Sincerity/Delivery bend them via detune/rate. If a phrase file is missing the
app falls back to the browser's `speechSynthesis`, which browsers cannot
capture into a recording — you'd get the text on screen but not in the audio.

## Brand assets

The favicon and the social share card are **drawn by the same canvas vocabulary
as the broadcast monitor** — the wordmark monogram, the masthead rule, the beat
ribbon with its playhead frame, the equalizer, and the HR stamp. Regenerate them
with:

```sh
npm i -D playwright-core   # only needed to regenerate
node scripts/make-brand-assets.mjs
```

That writes `public/favicon-16.png`, `favicon-32.png`, `apple-touch-icon.png`,
`icon-192.png`, `icon-512.png`, and `og.png` (1200×630).

LinkedIn Lessons has its own set, drawn by the same hand — the `LL` monogram
with the LinkedInification dial where the mixer has its beat ribbon:

```sh
node scripts/make-lessons-assets.mjs
```

### Barry from Compliance

<img src="public/barry/barry-noted.png" width="220" alt="Barry from Compliance, a pixel-art pigeon in a top hat, with an ASCII-style speech bubble that says NOTED." />

The Linked Beats mascot: a hand-plotted 48-grid pixel pigeon — top hat,
cobalt lanyard, laminated badge — who speaks in ASCII-style bubbles set in
a 3×5 pixel font. Seven flat colors, nearest-neighbor only, no antialiasing
anywhere. He currently minds the Company Store's empty order form
("coo. coo."); his approved statements live in `scripts/make-barry.mjs` —
add a line to `VARIANTS` and regenerate:

```sh
node scripts/make-barry.mjs
```

That writes the plain sprite (`public/barry/barry.png`, plus the raw 48-grid
`barry-48.png`) and one PNG per statement — NOTED. · COO. COO. ·
PER MY LAST EMAIL. · LET'S CIRCLE BACK. · FLAGGED FOR REVIEW. (the cobalt
compliance chip) · AS PER POLICY. Display at an integer multiple of the
logical grid with `image-rendering: pixelated` to keep him crisp.

That writes the `public/lessons-*` icons and `lessons-og.png` (1200×630).

The site is live at **https://linkedinbeats.com**. The `og:url` / `og:image` /
`twitter:image` / `canonical` tags in `index.html` hold that origin absolutely,
because every social scraper requires an absolute URL — update them there if the
site ever moves. `site.webmanifest` uses relative paths and needs no change.

## Structure

```
src/
  main.jsx                 entry
  CircleBack.jsx           the mixer screen: state + lookahead scheduler + export flow
  audio.js                 CBAudio drum synth (pure WebAudio, no samples), sample/phrase
                           buffer playback, recording tap; CBVoice phrase bank + speech fallback
  exporter.js              WebCodecs mp4 pipeline + MediaRecorder fallback helpers
  song.js                  the house band — key, chords, bass, arps, stabs, setlist
  randomizer.js            the Reorg — style-based drum pattern randomizer
  feed.js                  the engagement engine's fake comment pool
  lexicon.js               full LinkedIn phrase bank (openers / buzzwords / AI tells / closers)
  lessons/
    main.jsx               /lessons/ entry
    Lessons.jsx            the generator screens: categories → interview → result
    categories.js          the six interview flows and their reactions
    generator.js           seeded template engine, the dial, transforms, roast, humanizer
    score.js               post diagnostics (reuses remix.js's Thought Leadership Index)
  store/
    main.jsx               /store/ entry
    Store.jsx              the storefront: grid, product detail panel, order drawer
    products.js            the CS-1 catalog — shared by the page and the server
    store.css              the store's classes, values verbatim from the handoff
  styles.css, tokens/      design tokens as CSS custom properties
  components/
    stage/                 StageKey — the three performance keys
    chassis/               Unit, Masthead, Ticker, Bay, Silk, Readout, Stamp
    controls/              Button, Knob, Kbd
    pads/                  Pad, KeyPlate
    sequencer/             StepGrid
    broadcast/             Monitor (the 1080×1080 clip canvas)
public/phrases/            recorded phrase bank (01.wav … 16.wav)
public/store/              product photography (webp, from the handoff uploads)
server/store-service.js    Stripe Checkout + Printify fulfilment for the store
design_handoff_circle_back_mixer/   original design handoff (reference)
design_handoff_company_store/       the Company Store handoff (reference)
```

Audio starts on first gesture (autoplay policy).

Circle Back® is not affiliated with your network.


## Corporate pop homepage

The homepage at `/` (also available at `/v2/`) is the corporate pop-art design: a six-print portrait hero, Circle Back Radio, the corporate hits, Roast My Post, and featured Company Store products. The existing mixer lives at `/studio/`. Old `/#beat=…` links redirect there with their text intact; Lessons and Roast now link directly to the studio.

The five named tracks are finite live arrangements of the existing `src/audio.js` engine, `src/song.js` house band, and 17 existing recorded phrase clips. They are not new rendered song files. Each has its own tempo, phrase sequence, key, progression, and duration. Playback starts only after interaction. The transport owns a separate audio graph, suspends it on pause, closes it on seek/track change/unmount, and uses the audio clock for progress and lyrics.

Singalong words use 100% opacity for the current word and 25% for the surrounding phrase. Boundaries are **estimated**, using detected speech bounds and syllable weights; the recordings do not contain measured word timestamps. `src/home/tracks.js` keeps this timing layer separate so forced-aligned timestamps can replace it later. Reduced-motion preferences disable decorative animation.

The Roast form uses the existing `#roast=` handoff. Featured product names/prices come from the shared catalog, and `?product=CS-…` opens the appropriate product detail. Checkout and voice-generation services are unchanged.

Validation: `npm run check:home`, `npm run check:lesson`, `npm run check:store`, and `npm run build`. The homepage check reads actual WAV files and checks cue spacing, word highlighting, pause/resume, seeking, track changes, shuffle, volume, cancellation, and load failures. Browser visual/audio QA is still needed on real desktop and mobile devices.

For a separate review deployment, `VITE_TOOL_BASE_URL=https://linkedinbeats.com/` and `VITE_STUDIO_URL=https://linkedinbeats.com/` point secondary tools to the current production site while the new player runs in the preview. Leave both unset for the production build.

### Homepage artwork

Generated with the built-in ImageGen tool, then converted to WebP without changing composition:

- `public/home/corporate-portraits.webp`: faithfully recreate the approved sketch's six identical corporate headshots in a 3×2 screen-print grid; blue/black, pink/red, yellow/black, pink/black, cream/blue, red/black; paper grain; no words, sticker, UI, margins, or borders.
- `public/home/thought-leader-cap.webp`: centered realistic cobalt blue six-panel cap with white THOUGHT LEADER embroidery on warm yellow; soft studio light, cotton texture, subtle shadow, no extra objects or text. Labeled as a design preview on the homepage and store.

The Per My Last Email shirt uses the existing catalog photograph. The HR sticker, sticker sheet, posters, and receipt are native HTML/CSS. Anton, DM Sans, and Roboto Mono are served locally with their OFL licenses under `public/home/fonts/`.


### Storefront and texture refinement

The homepage uses a subtle screen-print dot texture on Circle Back Radio, pink graph paper in Roast My Post, and larger editorial merchandise images. Shared `src/brand/Footer.jsx` links to Look Serious, aaroncphelps.com, and Aaron’s LinkedIn. Roboto Mono handles numbers, prices, product metadata, and utility labels.

`/store/` carries the same paper/yellow/blue/pink palette into an “Out of Office” campaign, nine-item catalog, category filters, product dialogs, and shopping bag. `src/store/ProductVisual.jsx` supplies consistent imagery across homepage, catalog, detail, and bag; generated and CSS-based mockups are labeled design previews. Product dialogs require an explicit apparel size. Native `<dialog>` handles focus containment and Escape, with scroll locking and focus restoration. The existing `cs-order` bag is retained, sanitized, and priced from the catalog; quantity changes, free-shipping progress, and checkout errors are reflected in the bag. Checkout API and fulfillment configuration are unchanged.

Additional generated artwork: `public/store/cs-103.webp`, created with ImageGen and converted to WebP. Prompt: minimalist fashion retail product photograph, off-white heavyweight cotton unisex T-shirt laid flat on a pale dusty-pink paper surface; black Helvetica-style “SERIOUS.” centered on the chest; clean overhead composition, subtle natural fabric folds, soft studio light and realistic shadows; no props, logos, watermarks, or extra typography. This is a design preview, not a photograph of manufactured stock.

Store interaction verification covered deep-linked products, required sizes, category filtering, quantities, catalog-derived prices, bag persistence/removal, checkout failure recovery, cancel handling, focus restoration, footer destinations, and all product-image paths using jsdom (native dialog methods stubbed). Real browser layout, native dialog, and touch verification remain outstanding.


## Corporate intake and tactile studio

`/lessons/` now opens one complete intake form instead of a one-question interview. The category boxes, dynamic announcement types, numbered dark blank fields, live Mad Libs statement, declassification count, reacting department note, and example-fill action form the input experience. Examples respect the announcement type. Active drafts survive category switching and answer editing; announcement type switches keep separate drafts while the form is mounted. Blank fields retain the generator’s existing fallback behavior. The supercharged post, five LinkedInification levels, diagnostics, copy, modifiers, roast, and studio handoff remain. The selected level/seed/modifiers survive answer editing. Generation stays local to the browser.

`/studio/` opens the tactile Circle Back desk: layered physical controls, 16 phrase pads, an actual spectrum display, four channel faders and mute buttons, master gain, keyboard-operable rotary controls, voice environments, performance energy, and export actions. The original stage and advanced sequencer remain accessible and share the same engine/state. Shortcut handling respects focused controls. The desk scrolls the remix form into view when a post arrives from Lessons.

Six original four-bar grooves in `src/studio/grooves.js` provide distinct drum, bass, harmony, arp, and swing patterns: Reply-All Disco, Quarterly Funk, Mandatory Rave, Inbox Zero, Executive Decision, and Lunch Break. The groove selector keeps uploaded-sample and voice programming when changing the backing music. MIDI download exports a format-1 Standard MIDI File with a tempo track and separate drums, bass, chords, and arp tracks at 480 PPQ; voices and audio effects are not MIDI. It exports the current instrumental pattern at the current tempo, including swing. Preset grooves include their key parts even at groove energy; the existing randomly generated band behavior is unchanged.

The audio engine now has unity-default drums, bass, music, voice, and sample buses before the master/compressor/export taps. Desk faders set channel gains; voice effects retain a separate gain stage, so distortion compensation cannot overwrite the voice fader. Browser speech fallback uses the voice/master volume for subsequent utterances and cancels when muted. Native speech remains outside Web Audio recording, as before; prerecorded and generated clips route through the export bus.

Validation: `npm run check:studio` checks all six arrangements, independent MIDI parsing (headers, lengths, tempo, channels, timing, note pairing), and a Web Audio graph double verifying isolated fader/mute and shared output/export routing. Existing homepage, phrasebook, store, and voice checks and the production build pass. jsdom interaction checks covered all Lessons categories, dynamic fields, examples, clearing, edits, level persistence/copy; and studio grooves/BPM, gain/mute, rotary keys, pads, transport, stage/sequencer round trips, and the Lessons handoff. Audio/canvas were mocked for DOM checks. Real-device layout, audio audition, pointer/touch and native export verification remain outstanding; no browser-control skill was available in this environment.
