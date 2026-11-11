# SYNERGY.EXE · Career Mode

The playable game at `/game/`. It is Synergy's first week. He states a fact in the break room
("The onboarding is a PDF."), nobody reacts, and he climbs the office catching LinkedIn
phrases. His posts are built only from the phrases the player caught. The running joke: the
fact never gets fixed, it gets optimized. One tower, five floors, two endings.

The frozen v1 prototype is kept, untouched, in `design_handoff_synergy_exe/`.

## The tower

| Floor | What happens |
| --- | --- |
| 01 Break room | Four lines of dialogue. The fact gets 0 reactions. |
| 02 Open plan | Learn to move, jump and bounce. Rolling chairs. Desk 1: a post that keeps the fact. |
| 03 Meetings | Kevin takes credit for your last phrase; land on him to take it back. Two rooms with a meeting in progress: move while the host is looking and the call rings, Synergy is pulled in front of the screen, and the scene cuts to the meeting from the inside, 47 people watching. A hop straight up is always allowed. |
| 04 Boardroom | The meeting he cannot walk around. Three shares that land, or the fact three times until someone listens. |
| 05 Executive | The VP of Reactions ("Optimize the onboarding."). Dodge the action items, wait for "out of office", land on him. Desk 2: optimize the fact, or stand by it. |
| Roof, or back down | Optimize it ("Proud to be optimizing the onboarding process."): the ship, the launch, and the onboarding is still a PDF. Keep the fact: take the lift down and onboard the new hire in person. It takes one minute. |

Secrets: one mug per platforming floor (a supply closet, a print room, a top shelf), a printer
that is still loading, five taps on the title card.

Lighting rule, from v1: lights on when Synergy performs, lights off when he climbs.

## Files

| File | What it holds |
| --- | --- |
| `level.js` | The floors as text maps, the phrases, every line of dialogue. Pure data. |
| `physics.js` | Synergy's body: one fixed 120 Hz step. Pure. |
| `plan.js` | The planner: which tiles are reachable, and the inputs that get there. Runs `physics.js`. |
| `world.js` | The floors in motion: chairs, Kevin, the inbox, meeting rooms, the VP, camera, drawing. |
| `scenes.js` | The lit scenes: break room, the post, the boardroom, the lift, both endings. |
| `score.js` | Music and sound. The band is `src/allhands/instruments.js`, synthesized live; the voices are the Cutting Room film takes. |
| `art.js` | Palette, sprites, and canvas type set in the Peg Board faces (PEG-3, PEG-5). |
| `ui.js`, `state.js`, `main.js` | Canvas fit, meters, cards, save file; shared state; the loop, input, pause, install. |
| `game/index.html`, `game.css` | The cabinet: mast, meters, screen, controls. |
| `public/game/` | Web app manifest, service worker, icons, share card. |

## Editing a floor

Floors are text. One character is one 8-unit tile; the legend is at the top of `level.js`.
Synergy jumps 4 tiles up and about 5 across. After any change:

```bash
npm run check:game
```

It proves, with the game's own physics, that every phrase, mug, desk and lift can be reached
and that no ledge is a dead end. `node scripts/check-game.mjs --maps` prints each floor with
its reachable tiles.

## Checks

```bash
npm run check:game
```

```bash
npm run play:game
```

`play:game` plays the whole tower in headless Chromium with the real controls (it needs
Playwright and a running server; `--ending b` takes the second ending, `--touch` uses the
touch controls, `--url` points it elsewhere). `node scripts/make-game-icons.mjs` redraws the
icons and the share card from the sprites.

## The app

Today it is an installable web app: Add to Home Screen on iOS, Install on Android and desktop
Chrome. It opens full screen, saves progress at each floor, and plays with no signal after
one visit. The service worker is scoped to `/game/` and touches nothing else on the site.

For the App Store and Play Store later, wrap the same build (Capacitor, with `dist/game` as the
web directory). Nothing in the game calls the server.

## Console

`SYN` in the console: `SYN.state`, `SYN.run`, `SYN.floor`, `SYN.loaded()` (13 voice takes once
sound has started), `SYN.go('floor', { i:3 })` to step out on a floor.

## Not verified

Safari and Firefox (only Chromium was available to the tests), real touch hardware, a gamepad,
and the mix by ear. Instrument levels were matched to v1's sample pack by measurement.
