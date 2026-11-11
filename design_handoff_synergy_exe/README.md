# SYNERGY.EXE · Career Mode · v1 handoff

A playable three-minute game for LinkedIn Beats. Synergy states a fact in the break room,
nobody reacts, and he climbs the office catching LinkedIn phrases. The posts he writes are
built only from the phrases the player caught. They get longer as the facts go to zero.

This folder is the frozen v1. Install it as-is first. Do not refactor during the install.

## Install (for Claude Code)

1. Copy `game/index.html` from this folder to `game/index.html` at the repo root.
2. In `vite.config.js`, add one entry to `build.rollupOptions.input`, beside `museum`:

   ```js
   // SYNERGY.EXE, the career-mode game (v1 prototype). Unlisted and noindex, served at /game/
   game: fileURLToPath(new URL('./game/index.html', import.meta.url)),
   ```

3. Run `npm run build`, then `npm start`, and open `/game/`.
4. Keep this folder in the repo as `design_handoff_synergy_exe/`, like the other handoffs.
5. Leave it out of the site menu and footer until Aaron approves. The page is `noindex, nofollow`.

That is the whole install. The page is one self-contained file: no imports, no API calls, no
server route. Its script is a classic inline script, so Vite passes it through untouched.

## Acceptance

- `/game/` shows the title card with Synergy and a "Start career" button.
- Break room: four lines of dialogue, lights on. Space or tap advances.
- Climb: arrow keys and space on desktop, three buttons on touch. Ten phrases, three chairs.
- Desk 1: typing close-up, then a LinkedIn-style post that keeps the fact.
- Desk 2: posting with the fact gets 3 reactions and "Bit specific." Cutting the fact gets up to 9,999.
- End card: "Coffee: still broken." and "Circle back" restarts.
- `SYN.loaded()` in the console returns 19 once sound has started (all clips decoded).

## What was verified, and what was not

Verified at commit `53d49c2`: `npx vite build` passes with the entry added; `/game/` loads
from `dist`; all 19 clips decode; a scripted full playthrough runs without page errors in
headless Chromium at 390 × 780.

Not verified: the mix by ear, real touch devices, Safari, the full `npm run build`
(its two pre-build scripts were not run), and the Docker image.

## How it is built

| Part | Where in `game/index.html` |
| --- | --- |
| Level, phrases, post lines, intro script | `LEVEL`, `WORDS`, `INTRO`, `FACT` |
| Sprites (bitmap strings) | `HEAD`, `TORSO`, `LEGS`, `PERSON`, `ICONS` |
| Music and sound | `Score` (hooks: `setLevel`, `duck`, `accent`, `pause`, `resume`, `toggle`) |
| Break room theater | `stepIntro`, `drawIntro` |
| Climb | `stepClimb`, `drawClimb`, `grab` |
| Posting | `startPost`, `publish`, `stepPost`, `drawPost` |

Lighting rule: lights on when Synergy performs (break room, posting), lights off when he climbs.

Canvas is 160 units wide, drawn at an integer scale. All DOM text uses Silkscreen and VT323
from Google Fonts. The site's own `SynergyArcade` face and the Peg Board faces are the
natural replacements.

## Sound: what is embedded, and the follow-up

v1 embeds 19 MP3s as base64 so the file runs anywhere. They are copies of files already in
the repo under `public/cutting-room/sounds/`:

| Key | File |
| --- | --- |
| kick | instruments/kick-5bb68a50.mp3 |
| clap | instruments/clap-4b741d7b.mp3 |
| hat | instruments/hi-hat-ce7865f7.mp3 |
| ohat | instruments/open-hi-hat-51e334d1.mp3 |
| rim | instruments/rim-abff639a.mp3 |
| shaker | instruments/shaker-e94ee0c6.mp3 |
| gang | instruments/gang-clap-4d934a91.mp3 |
| crash | instruments/crash-81a9db91.mp3 |
| impact | instruments/impact-e0413ce2.mp3 |
| down | instruments/downlifter-2b69295c.mp3 |
| chime | instruments/chime-f8795589.mp3 |
| mug | instruments/mug-32de1514.mp3 |
| key | instruments/keyboard-click-0dd7c3db.mp3 |
| creak | instruments/chair-creak-926c39f8.mp3 |
| printer | instruments/printer-feed-2d4dc5c1.mp3 |
| tom | instruments/floor-tom-479c5814.mp3 |
| humbled | film-voices/welcome-humbled-53568647.mp3 |
| circle | film-voices/welcome-v2-circle-phrase-b18779d7.mp3 |
| linda | film-voices/welcome-linda-cbdc27fa.mp3 |

`bass`, `stab`, `pad`, `chop` and `rhodes` inside `Score` are copied from
`src/allhands/instruments.js`. Chords and tempo follow All Hands (Am9, Fmaj9, Cmaj9, G6/9, 120 BPM).

Follow-up, as a separate change after the install is confirmed:

1. Move the script to `src/game/main.js` and load it as a module.
2. Replace `SAMPLES` with fetches of the files above.
3. Import the instruments from `src/allhands/instruments.js` and delete the copies.
4. Add `scripts/check-game.mjs`: every phrase in `LEVEL` has a line in `WORDS`, every
   platform is reachable (rise of 28 units or less, gap of 60 or less), and both desks exist.

## V2 direction (from Aaron, not yet designed)

- Commander Keen feel: tiling simple vector backgrounds, a more interesting office-scape, real exploring.
- One full level that feels complete.
- Zoom meetings as obstacles or threats; eventually Synergy has to go through one.
- Meeting challenges with audio: "Does anyone have something to share for the good of the group?"
- Teammates who are subtly hostile. A boss who is an emoji or very pixelated.
- Easter eggs.
- Use the whole of `/allhands` and `/cutting-room`.
- Still to build from v1: the roof, the ship, the launch, and the return to the broken coffee machine.
