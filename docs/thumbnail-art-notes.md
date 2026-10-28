# Thumbnail art notes

Updated 28 October 2026. **Round 03 approved for publication by the user.** This is the art direction for the homepage’s lower carousel; the exploration history below records how it was reached.

## Purpose and scope

The homepage's lower carousel should become a compact, art-led video selection. The current portrait invitation/ticket cards feel too large. Preserve the fun and colorful site character while making the carousel shorter and easier to browse.

Artwork is a central creative project, not decoration to add after a layout is finished. Develop individual compositions at full size, then check them at thumbnail size. Variety alone is insufficient: cropping, framing, material, light, cast, type and the underlying idea need deliberate art direction.

Include short meetings AND selected finished films/training/music clips from the Cutting Room. Do not limit the carousel to the 14 meeting episodes. The user's approximately 60/90-second films are important parts of the content mix.

## Non-negotiable art direction

- **NO MICROTEXT on thumbnail art.** No tiny wordmarks, speaker credits, meeting numbers, timestamps, durations, faux metadata, categories, captions or explanatory footnotes baked into the art.
- Less text is good. Most images need no headline or one short phrase. A small video-meeting, camera or muted-microphone icon can carry the meaning.
- **TT Hoves** is the preferred family. Use the actual font assets; do not ask image generation to approximate the brand type. Keep type as an editable layer where possible.
- Use restrained text sizes. The original “Room to scale” lettering was too large. Occasional highlight strips are welcome, but not on every card.
- Artwork itself needs **rounded corners**, including its bottom corners above the white card body, as in the supplied Nebius references.
- Any colored frame must be **exactly the same width on all four edges**. Maintain concentric rounded corners: inner radius = outer radius minus frame width.
- Use actual character references. Synergy must never become a generic rounded robot. Original frames are preferred when they carry the right performance.
- Maintain a sense of Zoom/video meetings: real camera tiles, active-speaker outlines, patient webcam expressions, headsets, camera-off states, or a small meeting symbol. Do not recreate a cluttered full conferencing interface.
- The site is fun. Keep visual invention, color and personality. The humor itself is dry and almost imperceptibly sarcastic, presented with corporate sincerity.

## What the Nebius references mean here

The reference is about compositional craft: bold rounded mats, occasional outlined frames, cutouts that interact with the composition, textured/highlighted typography, photographic depth and varied visual hierarchy. Do not reduce it to “different colors on the same template.” Do not copy Nebius branding.

A frame can form an aperture, group a meeting grid, or establish a strong graphic silhouette. Character detail and photographic staging should be specific to LinkedIn Beats.

## Feedback by exploration

### Early mockups
- Tall ticket/invitation posters were oversized. Their invitation bars, stamps, avatar rows and repeated Join Meeting footers consumed too much space.
- The first landscape concepts were too playful: reaction poses, doodles, exaggerated headline styling and generic YouTube conventions made the sarcasm obvious.
- The subsequent quiet split-photo cards were too plain, simple and flat. Dry humor does not mean bland art direction.
- The generic robot used in early previews was wrong. Do not reuse it as meeting Synergy.

### Round 01
- “Before we begin”: substantial cobalt/black frame with real Synergy references was a step forward.
- “An exceptional week”: dimensional folder/material study explored the older editorial feel, but later typography direction favors Hoves over serif.
- **“Room to scale” is liked.** Retain its human cast and layered editorial composition. Improve the colors, reduce the headline, use TT Hoves, remove ALL microcopy, and ensure rounded artwork corners.

### Round 02
- User: “the rest are looking good.”
- Keep developing Quick sync, Gallery view, On mute, and overlapping meeting windows.
- The **orange/chrome Offline sculpture feels off-brand and too polished**. Orange itself is not banned; the glossy hardware-ad treatment does not carry the fun of the rest of the site.
- The empty **Joining conference room is also too polished/generic**. It may have a role, but should not define the direction or displace the cast-led art.
- Treat those last two as secondary explorations, not the core selected set.
- Quick sync and On mute revealed uneven colored frame widths. Correct the construction rather than visually compensating for the imbalance.

## Layout

Use compact landscape artwork, initially about 3:2, around 340–380 CSS pixels wide. Attach a short white title panel beneath it. Both the artwork and card body should have deliberate rounded corners. Keep the art visually dominant and the title panel concise. Preserve a partial next-card peek where appropriate.

The approved selection mixes 3:2 compositions with 16:9 film stills. A 16:9 source stays 16:9 when a 3:2 crop would remove important ensemble members. Avoid cutting away faces or the key action just to force every source into a crop.

If films join meetings, review the section's “14 meetings / seven agendas” language and navigation destinations. Do not present every film as a meeting or send film cards to unrelated studio episodes. Suggested neutral section descriptors to explore: “From the office” or “Meetings, films & other updates.” Existing “Humbled to share.” can still work.

## Border implementation

The review's earlier `inset:3.7%` was incorrect for a uniform landscape frame: horizontal offsets resolve against width, vertical offsets against height.

Use a single length shared by every edge. Example:

```css
.thumbnail {
  position: relative;
  aspect-ratio: 3 / 2;
  border-radius: 28px;
  overflow: hidden;
  container-type: inline-size;
  --frame: clamp(8px, 3.2cqw, 18px);
}
.thumbnail__image {
  position: absolute;
  inset: var(--frame);
  border-radius: calc(28px - var(--frame));
  overflow: hidden;
}
```

Resolve the cqw length on the child against the thumbnail's width. All four inset distances must match. For grid art, apply the same inset to its inner grid instead of mixing percentage padding and inset rules. Check at compact, desktop and expanded inspection sizes.

## Canonical identity and font sources

- Synergy: `public/studio/season/posters/synergy-camera-v2-listening.jpg`.
- Secondary mechanical construction reference: `public/share/synergy-team-20261022-v2.jpg`.
- Synergy has angular faceted/riveted cream sheet metal, worn grey patches, a single black facial screen, green pixel eyes, black headset and boom mic, exposed mechanics and a name badge. For motion, follow the Cutting Room continuity notes about the fixed-height horizontal speech row.
- The rounded illustration robot in `public/home-2/office-robot.webp` is not the meeting character reference.
- Humans: `people-listening.jpg`, `drums-listening.jpg`, `arjun-listening.jpg`, `linda-listening.jpg`, `keys-full-listening.jpg` under `public/studio/season/posters/`.
- TT Hoves: `public/home-2/fonts/tt-hoves-regular.ttf` and `tt-hoves-demibold.ttf`.
- Palette comes from the site: cobalt, cream, deep navy/forest, yellow/citron, pink, powder blue, with selective lavender. No single color system is locked for all cards.

## Cutting Room selection

Reviewed the live [Cutting Room](https://linkedinbeats.com/cutting-room/) and `src/cutting-room/catalog.json`. Use exact current asset IDs, not filenames guessed from a scene. The live page's feature heading is hard-coded to Welcome to the Office while its featured asset currently points to Learn to Speak LinkedIn; use the catalog record, not that heading, to identify a film.

| Film | Catalog duration | Catalog status | Carousel relevance |
| --- | --- | --- | --- |
| Welcome to the Office — V6 | 59.958s, approximately 1:00 | Current edit | Primary non-meeting addition. The user's VHS-cameraman/applause still is this film's poster. |
| Let’s Circle Back — Synergy corrected | 90s | Current edit | Longer musical meeting; use the corrected Synergy version. |
| Authenticity Rollout — 90-second version | 90.02s | Needs review | The user's printer/conference-table still. Strong scene candidate; preserve its existing continuity-review flag. |
| Training 02 — Caffeinated Edition | 50s | Current edit | Non-meeting training/coffee/typing interlude. |
| Make It Sound Like Me — Windows voice | 81.875s | Available edit | Additional longer non-meeting candidate; full-clip review still noted by the catalog. |
| Learn to Speak LinkedIn — Synergy recut | 44s | Current edit | Secondary training option using corrected Synergy. |
| One Mind, Many Perspectives — Synergy corrected | 98.346s | Current edit | Longer group-call option. |

Exact IDs:
- `welcome-to-the-office-v6-5adc47bd`
- `let-s-circle-back-synergy-corrected-d6ecf221`
- `authenticity-rollout-90-second-version-5733dfd7`
- `training-02-caffeinated-edition-0d1af435`
- `make-it-sound-like-me-windows-voice-724e72a6`
- `learn-to-speak-linkedin-synergy-recut-e95adb5d`
- `one-mind-many-perspectives-synergy-corrected-4f6769ca`

The Authenticity 90s record specifically calls for checking robot mouths, paper stability, laptop action and voice assignment. Thumbnail inclusion in an art study is not a claim that the full clip has passed that review.

The no-microtext rule applies to designed overlays and labels; incidental lettering already on an in-scene prop is not a reason to alter the original footage.

Use film/play icons for finished films where a meeting-camera icon would mislabel the content. Titles and useful duration information can live below the artwork, at a readable size; do not reintroduce tiny artwork labels.

## Working artifacts

Local art project: `/Users/ap457/Projects/linkedinbeats-meeting-art/`.
- `round-01/`: three initial individual studies, canonical sources, generation prompts and review board.
- `round-02/`: four text-free generated plates, two compositions using original cast stills, actual Hoves overlays, editable frames/icons, headline comparison toggle. Equal-frame fix applied.
- `round-03/`: refined text-free Room to scale, corrected shared frame geometry, and a mixed meeting/film art selection.

Generated artwork uses the built-in image generator. Prompts are saved with each round. Original stills are preserved. Artwork notes and local previews do not constitute a live site deployment.

## Round 03 verification

The local review board contains nine studies: the refined Room to scale, four retained Round 02 concepts, and four film concepts. Orange/chrome and Joining are omitted from this main set. DOM measurements at the review size confirmed identical top/right/bottom/left distances for every framed artwork. The border fix was also applied to the Round 02 board. Film links point to the catalog asset IDs; the longer Authenticity film remains a review candidate.


## Approved release — 28 October 2026

User sign-off: “this is beautiful … you nailed it. update art direction for this section—lets post!” Round 03 is the approved visual direction. Future revisions should build on this selection rather than restart the style exploration.

The homepage keeps “Humbled to share.” with the eyebrow “From the office” and the descriptor “Meetings, films and other company updates.” The carousel contains nine compact cards with white caption panels, approximately 300–380 CSS pixels wide, a partial next-card peek, 28px art corners, and equal-width colored frames. There is no automatic scrolling. Meeting links open their corresponding Studio episode. Films open an accessible inline video dialog with native controls, Escape/close, focus return and a direct-video fallback; they do not expose the production catalog navigation.

| Order | Artwork | Destination |
| --- | --- | --- |
| 1 | Room to scale — cream / powder blue, smaller highlighted Hoves | Unlocking our collective potential (`unlock-0`) |
| 2 | Welcome to the Office — original applause scene / butter frame | V6 film, approximately 1:00 |
| 3 | Quick sync — canonical Synergy / forest / citron | Optimizing the onboarding (`onboarding-0`) |
| 4 | Gallery view — original four-person webcam grid / cobalt | What’s everyone working on? (`standup-0`) |
| 5 | On mute — Linda / peach / plum / lilac | A seamless first-touch experience (`onboarding-1`) |
| 6 | Authenticity Rollout — original ensemble / cobalt | Existing 90-second version |
| 7 | Caffeinated Edition — clean typing scene / pink | Training 02, 0:50 |
| 8 | Same link — overlapping original camera windows / lavender | We’ll take this offline (`offline-0`) |
| 9 | Let’s Circle Back — original six-camera grid | Corrected Synergy film, 1:30 |

The approved Authenticity thumbnail links to the existing 90-second cut. This release does not revise footage or change its underlying catalog “Needs review” continuity notes. That content-review history remains intact.

### Production sources

- `src/home-2/MeetingShowcase.jsx`: carousel and film dialog.
- `src/home-2/ShowcaseArtwork.jsx`: native editable compositions using original cast images.
- `src/home-2/showcase-artwork.css`: artwork proportions, Hoves, colors, icons and uniform frame construction.
- `src/home-2/meeting-showcase.css`: compact rail, caption panels, responsive layout and player.
- `src/home-2/showcase-selection.js`: explicit ordered meeting/film destinations.
- `public/home-2/artwork/meetings/`: three optimized 1080px WebP art plates; about 353 KiB combined. They contain no designed type; visible headings remain actual Hoves in the page.
- Original film/cast stills remain in `public/cutting-room/posters/` and `public/studio/season/posters/`.
- High-resolution source plates and prompts remain in the local art project’s Round 02/03 folders, listed above. The orange/chrome and Joining studies are excluded.

### Release checks

Production build passed. Browser review confirmed the approved composition and Hoves at desktop and 390px mobile widths, no page overflow, working carousel movement, uniform measured frames (11.4685px on every edge at 358.4px art width; 10.2335px on every edge at 319.8px), real film loading/playback, and Escape closing with focus returned to the originating card. No microcopy was added to artwork.

## Sharing controls — 28 October 2026

Each carousel card has a small Share pill in its white caption area. Keep sharing controls out of the artwork. The chooser offers text message, email, Facebook, X/Twitter, copy link, and the native device share sheet when supported. Meeting links address their Studio episode. Film links use a stable homepage `film` query parameter, open the corresponding inline player, and receive film-specific server-rendered social metadata. Do not share an expiring media-storage URL or the unlisted production-library URL.
