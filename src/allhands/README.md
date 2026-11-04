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

## Drop Edition (default form)

`drop.js` arranges the same post into 30 bars, exactly 60.000 s. It brings in
the lady, the Circle Back woman: `public/phrases/NN.wav`, with word boundaries
in `lady-table.js`. Pick the form on the page under **The song**; Sound check
00 is still there.

| Time | Section | What happens |
|---|---|---|
| 0–4 s | Muted intro | The band plays through call audio: 300–3400 Hz, mono, crushed, with seeded dropouts. The call opens to the full mix in one 16th on "Thanks for joining". |
| 8–24 s | Verse | Synergy sings the post. |
| 24–39 s | Build | Her "Let's build." repeats each bar, then each ½, ¼, ⅛, 1/16 and 1/32 bar (42 hits). See the list below. |
| 39.000 s | Choke | Everything stops in 6 ms, reverb and delay returns included. "Let's circle–" plays after the choke. |
| 39.6–40.0 s | Silence | Exact digital silence. |
| 40.000 s | **BACK.** | Detailed below. |
| Bars 20–22 | Drop A | Half-time. Wobble bass, ride. "Pivot" bends down. |
| Bar 23 | Sink In | "Let that" plays dry. The whole room then slides 1 → 0.5× on a delay-line varispeed while she says "sink in", and her deep robotic voice sits on top. |
| Bars 24–27 | Drop B | Four-on-the-floor with the choir. "Leverage" lifts. She says "Read that again." and Synergy does. |
| 59.0 s | Outro | "Full stop." over a master tape-stop. She is routed after the tape, so she stops it and it does not stop her. |

**The build ladder:**
- The ladder climbs the A-minor pentatonic from G3, so every rung is in key.
- The build's swing tightens from .12 to 0, and the drum bus high-passes upward.
- She is pulled further into Synergy's vocoder at each rung.
- In bar 18 she and Synergy's stammer trade 16ths.

**BACK. at 40.000 s:**
- The impact: a tuned drop kick, a sub drop, a downlifter and a crash, the crash 120 ms late.
- The kick's transient passes, then drums and bass dip 7 dB under the word.
- Her deep robotic "BACK." answers one beat later.

**The deep voice** (`lady.js`) is baked offline, so it costs nothing during playback:
- the phrase at half speed;
- a vocoder with its synthesis bands shifted +2, so the words stay legible;
- a carrier on the chord root, a comb and tanh.

**Gates** (`scripts/measure-allhands.py <wav> --silence 39.70-40.04`), all passing on the sample post:

| Measure | Result |
|---|---|
| Integrated loudness | −10.2 LUFS |
| True peak | −1.10 dBTP |
| Loudness range | 7.1 LU |
| Drops over the verse | +4.7 LU |
| Drops over the verse, phone simulation | +2.9 and +3.5 LU |
| Silence before BACK. | −inf dBFS |
| Clipped samples | 0 |

**Mastering:**
- Exports get a true-peak limiter (`master.js`): 4× polyphase detection, 5 ms lookahead, a −1.3 dBTP ceiling.
- Live playback keeps the oversampled soft clipper.

**Whisper, full mix:** "Let's build", "Let's circle", "back", "let that sink in", "leverage", "read that again" and "full stop" all transcribe exactly. "Pivot" is heard as "give it": the bend is the joke, so judge it by ear.

## Pixel Text

**Download for Pixel Text** on the page saves a `.pixel.json` for Aaron's Pixel Text editor:
- **Audio:** the rendered WAV, embedded.
- **Cues:** one per line, each word starting at the moment it is sung. Positions come from the plan's timing, not from analysing the audio.
- **Effects:** the tape and the choke are applied.
- **The lady's words:** placed from her recording's word boundaries.

`pixel-export.js` implements the editor's own validation rules, recovered from its bundle, so the editor keeps every timestamp instead of re-spreading them:
- **Cues:** sorted, non-overlapping, at most 80 and 120 s.
- **Words:** they must match the cue text word for word.
- **Glyphs:** limited to the font's glyph set.

**Command line:** `node scripts/make-pixel-project.mjs --wav take.wav --plan take.json --out take.pixel.json` does the same from a render.

**Checks:** `npm run check:pixel`. Add `--bundle <editor>/assets/index-*.js` to cross-check against the editor's real code.

**Verified in the real editor:**
- It opens the Drop Edition project with 36 cues.
- All 344 of 344 timestamps are unchanged (0 s difference).
- The audio is embedded.

## The lady's exact phrasing

**`lady-phrases.json`** holds the measured word boundaries for all 57 recordings.

**How it's measured:** `scripts/align-lady-phrases.py` makes four passes:
1. pocketsphinx HMM forced alignment against the known text;
2. a cross-check with two CTC models (MMS_FA, wav2vec2);
3. every boundary snapped to the audio at 1 ms;
4. ear-verified corrections, kept in its `CORRECTIONS` table.

**Fields:** each word gets `start`, `end` and its vowel `onset`. Each phrase gets `f0` and a gain to a common speech level.

**Verification:**
- `--verify` re-hears every cut word with Whisper: 206 of 237 are heard alone, and the other 31 are short function words heard in context.
- An independent check (signal margins, two Whisper models, ±30 ms boundary sweeps) passed every slice the drop uses.
- That check also found the six joins now corrected. One was 23.wav "say": it was cut inside the glide, so it was heard as "save".

**Why it matters:** the drop cuts her from this table. `lady-table.js` loads it, and its hand-measured entries are only a fallback.

**Pixel Text projects:** `node scripts/make-lady-pixel-projects.mjs --out <dir> [--zip f.zip] [--check-editor <editor>/editor --check all]` writes one ready-to-open project per phrase:
- the 17 bundled in the editor, plus 50 "Let's build.";
- each with her WAV embedded and every word on its measured time.

All 18 open in the real editor with every timestamp unchanged.

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
