# Singing portrait homepage concept

An additive route at `/home-2/`. The current homepage and shared branding are not replaced. This concept is excluded from indexing.

## Interaction

Four portraits select existing radio arrangements. The fifth remains available in All tracks. The player uses `src/home/radio.js` unchanged: recorded phrase clips, pause/resume, seek, volume and track changes. Nothing autoplays.

`portraitRadio.js` reads each decoded vocal's RMS envelope and uses the existing estimated word timings to choose among six mouth shapes. This is stylized lip sync, not phoneme alignment. Silence closes the mouth; pause and reduced motion show the rest image. All timing is derived from the audio transport. A separate animation timer cannot drift after a seek.

The artwork is the approved generated six-state study (2026-10-15). `public/home-2/singing-states.webp` is a format-compressed copy, with no resizing or rearrangement. CSS crops one fixed base portrait and overlays only a feathered mouth patch from another cell. Color treatments are applied to the entire portrait. The other facial features remain fixed.

The LinkedInifier uses the existing `linkedinify` function. Roast passes the entered post to the existing roast route. Merchandise links to the current store's three preview products; no prices or order availability are invented.

## Typography provenance

- TT Hoves Pro Regular / DemiBold: user's `aphelps099/sbdc-advisor`, `design_handoff_learn_v2/fonts/`.
- GT America Extended Medium / Mono Regular: user's `aphelps099/look-serious`, `design-system/assets/fonts/`.
- GT Alpina Fine Condensed Light Italic: user's `aphelps099/aaroncphelps`, `fonts/`.

The Hoves and America files are Latin subsets. Font families and styles are scoped to this route.

## Checks

`npm run check:home` verifies the existing transport. `npm run check:home2` verifies vocal-only motion, silence/pause, frame mapping, all real clip arrangements and adapter lifecycle. `npm run build` includes the new entry without replacing `/`.
