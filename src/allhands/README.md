# All Hands · Sound check 00

`/allhands/` is Phase 0 of the meeting-band project: a post, sung by Synergy
over a house band, to answer one question before any video work starts.
**Would you play this at a party?** The page is unlisted, `noindex`, and not in
the site navigation.

## What happens

1. `lyrics.js` cuts the post into exact phrases. One becomes the hook (scored
   on short length and professional vocabulary); four become verses. Hashtags,
   links and emoji are dropped. Nothing is invented, except Synergy's two host
   lines: "Thanks for joining" and "Let's circle back".
2. `server/allhands-voice.js` (`POST /api/allhands/voice`) renders each word
   once with eSpeak NG: Synergy's `en-us` voice and pitch 35, at 175 wpm. It
   caches takes in memory and rate-limits per IP. No paid service.
3. `song.js` fits every word into a two-bar slot on a 16th grid. Squeezed
   words may speed up to 1.35×; a hook short enough for one bar is sung twice,
   and the second time it resolves. Melodies use A minor pentatonic, so every
   note fits every chord: Am9 · Fmaj9 · Cmaj9 · G6/9 at 120 BPM.
4. `engine.js` plays the arrangement: 28 bars, laid out as intro, verse,
   breakdown, drop and outro. A small set of respellings in `lyrics.js`
   (ChatGPT, KPI, B2B…) fixes eSpeak's worst readings without changing the
   on-screen lyric.

At 120 BPM four bars last exactly eight seconds. That is deliberate: Runway
clips of the cast can loop on bar lines in the next phase.

## The sound

- **Synergy** is eSpeak through a 28-band channel vocoder (`vocoder.js`). The
  carrier is a saw lead (plus a detuned saw and a sub-octave); in the hooks a
  four-voice chord choir joins it. High-frequency consonants pass straight
  through. *Sung / Spoken / Both* switch live, for A/B listening.
- **The band** is synthesized in the browser (`instruments.js`). There are no
  samples and no generated music:
  - Operations · drums: 909-style kick, clap, hats, open hats, rim, and the printer's paper-feed shaker.
  - Pat · bass (camera off): saw bass on the offbeats, plus a sine sub.
  - Keys: detuned saw stabs, plus a pad.
  - Kevin · guitar: muted Karplus-Strong funk chops.
- **Mix:** kick sidechain on bass, keys and guitar. Keys and guitar also dip
  under each sung word. Reverb, dotted-eighth delay, bus compression and a
  limiter, then a soft clipper.

## Measured, not guessed

The defaults were set by measurement in headless Chromium, using
`OfflineAudioContext` renders:

- **Intelligibility.** Whisper (`base.en`) transcribed voice-only renders.
  - A 70 Hz envelope follower with narrow (Q 5) bands moved the sung verse from
    about half the words to the same word error as the raw spoken take.
  - 175 wpm transcribed better than 154, both sung and spoken.
- **Balance.** Stems were measured before the master bus, in K-weighted
  loudness.
  - The verse vocal sits about +1 dB over the band.
  - The vocal level was then raised about 2 dB, because the drop is denser.
- **Groove.** In the spectrogram, the kick was shortened to about 0.34 s and
  the bass notes to 70% of their length, so the low end pumps.

Ears still decide. These numbers only rule out the obvious failures.

## Files and checks

- `npm run check:allhands` runs `scripts/check-allhands.mjs`, which covers:
  - lyric excerpts, respellings and syllables;
  - fitting invariants: no overlaps, inside the slot, bounded speed-up, notes in key;
  - hook repetition and the closing resolution;
  - endpoint validation, WAV repair, caching and rate limits;
  - a live eSpeak take, when installed.
- `node scripts/render-allhands.mjs --url http://localhost:5173` renders the
  song offline to WAV through the page itself. Options:
  - `--mode spoken`, `--mute drums,bass`, `--post post.txt`;
  - `--bars 16-20`, for a quick excerpt.
- Local development needs `espeak-ng` on the PATH. The Railway Docker image
  already installs it for the LinkedInifier's robot voice.
- The page's **Download WAV** is the same offline render, mutes included.

## Not yet

These are Phase 1 and later:

- the meeting grid and tiles;
- Runway loops;
- a vertical video export;
- share links.

The setlist and timing data that those phases need are already in the
`arrange()` plan:

- word onsets;
- sections;
- bars;
- per-stem levels.
