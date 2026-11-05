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
   and the second time it resolves. Synergy sings one word at a time (see
   "One word at a time" below). Melodies use A minor pentatonic, so every
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
- Local development needs `espeak-ng` on the PATH. The production Docker image (Render)
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
| 39.608–40.0 s | Silence | Exact digital silence: 0.392 s from the end of her tag to BACK., the wait every track now keeps (below). |
| 40.000 s | **BACK.** | Detailed below. |
| Bars 20–22 | Drop A | Half-time. Wobble bass, ride. "Pivot" bends down. |
| Bar 23 | Sink In | "Let that" plays dry. The whole room then slides 1 → 0.5× on a delay-line varispeed while she says "sink in", and her deep robotic voice sits on top. |
| Bars 24–27 | Drop B | Four-on-the-floor with the choir. "Leverage" lifts. She says "Read that again." and Synergy does. |
| 59.0 s | Outro | "Full stop." over a master tape-stop. She is routed after the tape, so she stops it and it does not stop her. |

**The build ladder:**
- The ladder climbs the A-minor pentatonic from G3, so every rung is in key.
- Each cut is tuned by the pitch of the audio it actually plays: "Let's" sits 2
  to 5 semitones above "build.", so tuning the short cuts by the phrase's median
  left the fast rungs up to 240 cents sharp. `scripts/measure-lady-pitch.py`
  writes a pitch track for all 57 recordings (YIN, 10 ms frames with their
  level, `lady-pitch.json`); `drop.js` tunes each hit by the median of the
  voiced frames it plays that sit within 6 dB of its loudest (its vowel, not
  the glide into it) and gates the hit to exactly that span. In the render,
  every rung of the default ladder lands within 40 cents of its declared note
  on every track and on three different pitch estimators. A whole phrase falls about 5 semitones and
  "Let's" scoops up about 5.5, so how far a rung is from its note depends on
  the estimator.
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

## The song book

Every post can become any of four songs. A **track** (`songbook/*.js`) is a
band chart and its sound; the **form** is the structure it performs. All four
play the Drop Edition; Sound check 00 stays Circle Back's own rehearsal.

| Track | Tempo, key | Drop Edition | The sound |
|---|---|---|---|
| **Circle Back** (`circle-back`, default) | 120 BPM, A minor, swing .12 | 30 bars, 60.0 s | French house. Am9 · Fmaj9 · Cmaj9 · G6/9, 909 kit, offbeat saw bass, detuned saw stabs, Kevin's muted chops. Drop A half-time on a wobble, Drop B four-on-the-floor. |
| **Humbled and Honored** (`humbled-and-honored`) | 92 BPM, E-flat major, swing .24 | 24 bars, 62.6 s | Neo-soul slow jam. E♭maj9 · Cm9 · Fm9 · B♭13sus (I-vi-ii-V), electric piano (two-operator FM, tremolo pan), finger snaps and a sidestick 18 ms behind the beat, round finger bass, Kevin's clean double-stops. The build rocks IV-V and never resolves; BACK. lands on the relative minor in a half-time bounce on a gliding 808; Drop B comes home to I; the outro is the amen, IV to I. |
| **Hustle** (`hustle`) | 130 BPM, F minor, swing .2 | 32 bars, 59.1 s | UK garage. Fm9 · D♭maj9 · E♭6/9 · Cm11 (i-VI-VII-v), shuffled 2-step kit (kick on one and the "and" of three, ghost snares), speed-garage reese bass jumping octaves, house organ stabs (drawbar harmonics, key click). The build rocks VI-iv under the ladder, VII for the last bar, BACK. on i. Drop A is the 2-step bass drop: every bass note sweeps its filter open and shut (the speed-garage growl) under the organ riff an octave up. Drop B goes four-on-the-floor with a sidechain that pumps bass, keys and pad. |
| **Offsite** (`offsite`) | 108 BPM, D major, swing .1 | 27 bars, 60.0 s | Voice-loop psych pop, the Panda Bear lane (see "Offsite" below). Dadd9 · G6/9, droning, the changes pushed onto the "and" of four; voices as the instrument (her ladder as a round, her impact word as a chant, his vocoder round a two-beat canon, a wordless formant choir); one loop from the first bar to the tape stop, leaning on the offbeats (soft even stomps, a room of clappers, rolling floor toms, the printer, keyboard clatter, a mug), desk slaps into the choke; a pump organ, Pat humming the root on the offbeats, Kevin's looping clean figure; a slow tape (half speed, an octave down) under the second verse, into Sink In and under the sign-off. BACK. is a bloom of voices with no slam under it; Sink In goes under water. |

**What a track defines.** `bpm`, `step` (one 16th in seconds), `swing`, `key`,
`pitchClasses` (its scale), `chords` (each: `root` for Pat, `notes` for the
four-voice choir and the pad, optional `keys` voicing, `avail`: the pitch
classes a melody note may hold over it), `chordAt(bar)`, `music` (Synergy's
nine-note melody table, the indexes a line resolves to, a repeated hook's
`home` notes), and `drop`: bar counts and sections, the moments (`unmute`,
`choke`, `impact`, `sink`, `stop`, `rise`), `swing(bar)`, `layers(bar)`,
`cutoff(bar)`, `slots(lyrics)`, Synergy's answers and stammer, the `ladder`
(tuning targets, the pentatonic it climbs, rungs in scale degrees), the tag's
tuning, where each lady role may sit (`places`), and section `energy`. Then
`mix` (stem levels and sends, room, duck release, keys high-pass), `sound`
(drop kick and sub drop tuned to the key, the build's saw riser) and `band`:
its own drums, bass, keys and guitar, called by `engine.js` once per 16th.
`kicksOf(bar, layers)` lists the band's kick steps, so the Peg Board's kick
accent follows each kit. Three optional band hooks (P7, Offsite's; a track
without them makes the same calls as before): `band.graph({ctx, I, graph,
step, sends, master})` builds the track's own structure with the graph (its
`buses`, and `choke(c)` / `release(t)`, which the engine calls when the band
chokes and when BACK. lands), `band.impact(api, b, bar, t, barEnd, T, step)`
replaces the shared impact stack (drop kick, sub drop, downlifter), and
`band.bar(…)` runs once a bar.

The engine keeps what every Drop Edition shares: the call audio and its
unmute, the choke, the tape (Sink In and the stop), the filters, the energy
automation, the choir, crashes, risers, the tuned impact, Synergy and the lady.

**Every track keeps the signature, in order:** the muted call intro unmutes on
"Thanks for joining"; the verses are the post's; the lady's ladder retriggers
at 1, ½, ¼, ⅛, 1/16 and 1/32 bar, climbing an octave through the track's
pentatonic from the scale note nearest her pitch; the choke; digital silence,
0.37 to 0.42 s from the end of her tag (Circle Back's 0.392 s, below); BACK. on a drop kick tuned to
the drop chord's root; Drop A; Sink In with her deep voice on the chord root;
Drop B; the tape stops on "Full stop.". Synergy's melody follows each track's
scale and is snapped onto the chord under every note. Her deep voice is baked
on the chord root, and in the new tracks its comb rings on that root too
(Circle Back keeps its A2 comb).

### The API

```js
import {arrangeDrop} from './drop.js';
import {TRACKS, TRACK_ORDER, DEFAULT_TRACK, trackOf, trackList, DEFAULT_CAST, LADY_ROLES, castOf} from './songbook/index.js';
import {FORMS, formPlays} from './forms.js';

const plan = arrangeDrop(lyrics, durations, {track:'hustle', cast});   // or (lyrics, durations, table, {track, cast})
FORMS.drop60.voiced(lyrics, {track})          // the words Synergy needs for that track
FORMS.drop60.arrange(lyrics, durations, {track, cast})
formPlays('soundcheck', 'hustle')             // false: Sound check 00 is Circle Back's
```

`buildGraph(ctx, options, plan)` takes the plan, so its track picks the mix;
`render(plan, …)` and `Performance.start(plan, …)` pass it. Old calls without
a track or a plan are Circle Back, exactly as before.

**Plan fields.** Every track's plan has the fields downstream code reads, with
the same meaning: `timing` (Float64Array, seconds per 16th, swing included),
`sections`, `bars[].layers`, `bars[].chord`, `lines`, `words`, `stutters`,
`lady`, `choke` `{at, until, time, gap}`, `tape`, `duration`, `bpm`, `key`, `step`. The
song book adds: `track`, `trackTitle`, `kicks` (the band's kick steps),
`marks` (`unmute`, `build`, `rise`, `choke`, `impact`, `sink`, `sinkEnd`,
`stop`, all in 16ths), `choke.dark` (seconds: the tag's gate; the Peg Board now
goes black from `choke.tagEnd`, below) and
`period` on ladder events (16ths to the next retrigger). Never assume 120 BPM
or a whole number of frames per 16th: read `plan.step` and `plan.timing`.

P4 adds, on every Drop Edition plan (seconds are plan time, `timing[0] = 0`):

- `choke.tagEnd`: when her tag stops sounding: the tag's start plus its gate
  and release, exactly as `playLady()` envelopes it (`drop.js ladyLength`).
  Circle Back's is 39.608 s, 118 ms after `choke.dark` (39.49 s). choreo's
  `boardState` and the video studio go black on the first frame after it plus
  the engine's latency and a codec's 5 ms tail (Circle Back frame 952): a board or
  picture that goes black at `tagEnd` goes black when she stops. The mix itself
  reaches the speakers about 16 ms after plan time (the bus compressors'
  look-ahead), as every other cue does.
- `energyTrim`: `{Verse: dB}`, the room the verse leaves the drops (below).
  `{}` when there is none.

P5 adds `stop`, the ending, measured the way `choke.tagEnd` is:

```js
plan.stop = {
  at:59.0,             // her stop phrase and the master tape-stop start (timing[marks.stop])
  tapeEnd:59.4,        // the tape has stopped: at + track.drop.stop.seconds
  end:59.832,          // her "Full stop." stops sounding: at + ladyLength(her stop event)
  display:'FULL STOP.',
};                     // end and display are null when the cast leaves the stop out
```

She is routed after the tape (she stops it; it does not stop her), so her
line outlasts it: Circle Back 59.832 s, Humbled and Honored 62.136 s, Hustle
58.986 s with today's cast, 0.43 s past `tapeEnd` on every track. A board or
picture that should stay lit until she finishes stays lit to `stop.end` (plus
the engine's 16 ms and a codec's 5 ms, as at the choke); `check-songbook`
proves it on every track with today's cast and each post's own. The render
hook returns it with the plan.

P6 moves the choke to where her tag must start (see "The wait before BACK."):

```js
plan.choke = {
  at:217.625,          // the step the band chokes on and her tag starts: a 128th, fractional (Humbled and Honored 13:9.625)
  until:224,           // the impact's downbeat, as before
  time:35.4823,        // seconds of `at` on the lady's clock: timing[floor(at)] + frac * step (the choke bar is straight)
  tagEnd:36.1283,      // when her tag stops sounding, as before
  gap:.3935,           // tagEnd to the impact: drop.js IMPACT_GAP, 0.392 s give or take half a 128th
  dark,                // as before, from `time`
};
plan.stop.line         // when her stop line starts: plan.stop.at, unless the track leads the tape (Hustle: 78 ms)
```

`marks.choke` is `choke.at`. Read `choke.time` (or `stepTime`/`ladyTime`),
never `timing[choke.at]`: on Humbled and Honored, Hustle and every recast tag
the choke is between two 16ths. Circle Back's sample post still chokes on 19:8
(312, 39.000 s).

and, with `arrangeDrop(lyrics, durations, {track, cast, coldOpen:true})`:

```js
plan.coldOpen = {
  impact:{at:0, until:.75, source:40.0, word:'BACK.', file:'06.wav'},   // source: the impact it copies
  rewind:{from:.75, to:1, rate:4, sourceFrom:39.0, sourceTo:38.0},      // plays sourceFrom back to sourceTo
  resume:1,                                                             // the song as it is, from here
};
plan.transports = [{kind:'rewind', at:.75, len:.25, audio:true, rate:4, sourceFrom:39.0, sourceTo:38.0}];
```

The cold open (plan.md section 2, signature moment 1) is the film's first
second on any track: 0-0.75 s is the impact as the drop plays it (her impact
word, dry and vocoded, the drop kick, the sub, the crash, the band's first
beat: the track's own render from `impact.source`), but without Synergy and
with her deep "BACK." faded out (below), 0.75-1 s is the last second of the ladder
before the choke rewound at 4x (`sourceFrom` back to `sourceTo`, filtered so
the 4x does not alias), and from 1 s the song is exactly what it is without the
cold open, so the length does not change. At film time t in the rewind the
sound is source time `sourceFrom - rate * (t - from)`: lock a REWIND picture to
that. Equal-power crossfades of 6 ms make the two joins.

**What the impact is cut from** (`engine.js coldSourcePlan`). In the song,
Synergy's Drop A hook comes in half a beat after BACK. and her deep echo one
beat after it (0.50 / 0.65 / 0.46 s), so a straight copy of 0.75 s cut both
mid-word at the rewind. The cold open is cut instead from its own render of
the same plan from the top, in which his words from the impact on are silent
(their notes and choir bars stay, so her vocoded BACK. rides his carrier as in
the drop) and her deep echo fades out on a raised cosine (up to 120 ms) that
ends 1 ms before the first crossfade. Measured on the sample post:
- Up to his first word the cold open is the drop's impact to 0 LSB on all
  three tracks: the same stack, the same bus.
- His stem from 0 to the first crossfade holds only her vocoded BACK. (the
  BACK. stack's vocoded layer, which has always gone through his vocoder);
  with that send off it is exact zeros. The song's own impact has his word at
  +6.5 / +5.8 / +7.4 dBFS (stem level) there.
- Her stem 10 ms before the crossfade: −49 / −38 / −45 dBFS, against −8 / −2 /
  −5 dBFS of deep echo the old copy cut.
- No click at the joins: above 4 kHz each 2 ms join window is no louder than
  the louder of its neighbours 4 ms either side (+0.4 dB at most), and no
  sample step at a join exceeds the steps around it.
The source render costs about two thirds of a song render more.

Off unless asked for: the page arranges without it and sounds as before. To
hear it: `render(plan, …)` plays a plan that carries `coldOpen` (or
`render(plan, buffers, {coldOpen:true}, lady)` adds it; `{coldOpen:false}`
leaves it out). Offline the source is rendered from the top to the bar
after the impact, so the rewind is the song's own samples. Live, `await prepareColdOpen(plan,
buffers, lady)` and then `Performance.start(plan, buffers, {…, coldOpen:parts})`
(a quick source render, the same music; `{exact:true}` renders from the top,
the same samples). A transport of your own calls `scheduleColdOpen(graph, parts,
t0)`. The render hook takes `coldOpen:true`:
`node scripts/render-allhands.mjs` with `--cold-open`.

### The cast

A cast names, for each of the lady's roles, which of her 57 recordings plays
it: `{file:'NN.wav', words:[first, last], display}`. `words` index into
`lady-phrases.json` (negative counts from the end); `display` is what the Peg
Board shows (default: the words in capitals). Name only the roles you change;
`null` leaves a role out. `castOf()` throws on an unknown role or a malformed
entry. The default cast is today's choices. Times below are at the recording's
own speed; "window" values are per track (Circle Back / Humbled and Honored /
Hustle).

| Role | Default | Where it sits | What it needs |
|---|---|---|---|
| `ladder` | 50 "Let's build." | The build: every bar, then every ½, ¼, ⅛, 1/16, 1/32 bar, up to the choke | Two words, the first short and hard-edged (≤ 0.2 s: it is the 1/8 cut; its first 0.1 s and 0.06 s are the 1/16 and 1/32 grains). Whole phrase ≤ 0.85 s, or it is gated at its half-bar rung (gate = 0.92 of the retrigger period: 0.92 / 1.20 / 0.85 s). A steady pitch: she is retuned to the scale note nearest her `f0` (±2 semitones) and pitched up to +12 semitones, so long sibilants turn to hiss. |
| `tag` | 06 "Let's circle" | Right after the choke, dry, on its own bus | The first half of a phrase whose last word is the `impact`: the joke is the missing word. It plays at ~1.1× (tuned to the key in the new tracks) and is heard whole. Its length is capped by the track's nominal choke-to-impact window (`drop.choke` to `drop.impact`: 1.00 / 1.30 / 1.15 s, less 0.45 s, so ≤ 0.64 s at its playback rate; the new tracks speed it up to 1.2× to fit). Circle Back gates it at 0.64 s. Then it starts where it ends 0.392 s before the impact (P6, below): today's "Let's circle" on Humbled and Honored plays its 0.646 s from 13:9.625 and leaves 0.393 s. |
| `impact` | 06 "back" | The impact downbeat, +5 dB, over the drop kick; vocoded on the key's tonic; her deep voice repeats it one beat later | One word, one or two syllables, ≤ 0.45 s, an open vowel. A word that closes the tag's phrase. |
| `bend` | 08 "Pivot" | A gap in Synergy's line in Drop A (candidate 16ths in `drop.places.bend`) | One word, 2 syllables, ≤ 0.5 s. It bends down 300 cents at 66% of the word and back by 96%: a word that means a turn. |
| `sink` | 15 "Let that sink in", `split:2` | Words before `split`: dry, Drop A's last bar (`places.letThat`). The rest: the Sink In bar, deep, while the whole room slows to half speed | Two to four words. The deep words are baked at half speed and held for the bar, so ≤ 1.0 / 1.3 / 0.92 s at the recording's speed. Her pause before the deep words is kept: it is the beat of air before the room sinks. |
| `lift` | 07 "Leverage" | A gap in Drop B's second bar | One word, 2 to 4 syllables, ≤ 0.7 s. Its last 28% rises 500 cents. |
| `punct` | 18 "Read that again." | A gap at the end of Drop B, right before Synergy sings the hook once more | A short command, ≤ 0.9 s, that makes the repeat a joke. |
| `stop` | 16 "Full stop." | The tape-stop mark (`drop.stop`), after the tape, so she stops it and it does not stop her | The last word(s), ≤ 0.8 s, falling intonation. |

A role that finds no gap is left out; the song plays without it. A recast
ladder stays in key: rungs are scale degrees above whichever note she is tuned
to. **Let the post choose** in the Song picker casts the post (see Casting).

### The wait before BACK. (P6)

Aaron, on the drafts: in one song the "Let's circle-" before BACK. "is spaced a
bit too far behind the preceding beat, so it feels like we wait just a few ms
too long for that big moment". Measured on the sample post with today's cast
(plan time; in the renders the wait from her last sample over -60 dBFS to
BACK.'s first is within 1 ms of it, 6 ms on the shortest recast tags):

| | Circle Back | Humbled and Honored | Hustle |
|---|---|---|---|
| The choke and her tag, before | 19:8, 39.000 s | 13:8, 35.217 s | 19:6, 35.769 s |
| Her tag ended | 39.608 s | 35.863 s | 36.379 s |
| BACK. | 40.000 s | 36.522 s | 36.923 s |
| The wait, before | **0.392 s** (0.78 beat) | 0.658 s (1.01 beats: she ended on beat 4) | 0.544 s (1.18 beats) |
| Recast tags, before | 0.392-0.697 s | 0.658-1.111 s | 0.532-0.960 s |
| The choke and her tag, now | 19:8, 39.000 s | 13:9.625, 35.482 s | 19:7.375, 35.928 s |
| The wait, now | 0.392 s | 0.393 s (0.60 beat) | 0.386 s (0.84 beat) |
| Recast tags, now (61 posts, both casts) | 0.385-0.392 s | 0.387-0.401 s | 0.386-0.398 s |

Circle Back, the one he did not flag, is the reference. The impact never
moves: BACK. stays on its downbeat. The choke moves instead, and her tag with
it (`drop.js`, `IMPACT_GAP = {target:.392, min:.37, max:.42}`):

1. Her tag's rate and gate are what they were (the track's nominal window,
   `drop.choke` to `drop.impact`, caps how long it may sound), so it is the same
   sound: before and after correlate at 0.998 or better, same level.
2. It starts on the 128th (an eighth of a 16th, 7 to 10 ms at 90-130 BPM)
   nearest the moment that ends it 0.392 s before the impact. The band chokes
   there, in 6 ms, as it always did; then exact zeros to BACK.
3. The ladder's last rung retriggers on at its period right up to the choke
   (holding its last note); a last hit with at least half its period left is
   gated to end at the choke. Humbled and Honored's last rung now has 19 hits
   to 13:9.625 (was 16 to 13:8), Hustle's 15 to 19:7.375 (was 12 to 19:6). The
   build's roll and riser run to the choke too.

Circle Back's sample post lands on 19:8 exactly: its plans (240 of 244 in
`check-songbook` section 1) and its render are byte-identical to before
(`6b8b86fa69ad9b08`, cold open `06c2d38fdb6a3b5d`). The Peg Board and the video
studio follow `choke.at`, `choke.time` and `tagEnd`: true black now starts 8
frames before the impact on all three tracks (frames 952, 868, 878).

**The ending.** Hustle's "Full stop." ended 2.5 ms before the film's
second-to-last frame, so the loop seam had one ghost frame and no black one.
Its stop line now leads the tape stop by 78 ms (`drop.stop.lead`, on the
128th): she says it, the tape stops under her a breath later (still 31:8). It
is heard to 58.924 s, 76 ms before frame 1416: her line, one black frame
(1415), the two ghost BACK. frames (1416-1417), as on Circle Back.
`check-songbook` holds every track and cast to 60 ms.

### The composition constitution

[`songbook/CONSTITUTION.md`](songbook/CONSTITUTION.md) is how 90% of LinkedIn
Beats music is built: Daft Punk, Panda Bear, Washed Out, Air and Kraftwerk. Its
backstory (Synergy is learning the synth, Synthia already plays it) is not a
feature: no song announces it; it keeps his lines simple and a little stiff and
makes hers the fluent ones. The three tracks are its reference recordings. `songbook/constitution.js` is the same rules as data
(`RULES`, `REFERENCES`, `RULE_TEXT`) and a lint:

```js
import {lintTrack, lintPlan, describe} from './songbook/constitution.js';
lintTrack('hustle')                 // or a chart object not yet in the book
lintPlan(plan)                      // an arranged Drop Edition
lintPlan(plan, gates)               // plus the mix, from measure-allhands.py --json
// → [{rule:'swing.light', level:'warning', reason:'swing 0.2 of a 16th: ...', declared:true}, ...]
describe(violations)                // readable lines
```

What it checks. On a track: tempo 90-130 and no double time; swing 0 to .12 and
the ladder straight from its 8ths; home in Aeolian or Dorian on a minor tonic
chord, or Ionian or Mixolydian for a haze song (one that takes Panda Bear or
Washed Out); a home chord without a major seventh (advice); a verse loop of 2 to 4 chords (chords outside it warn); Synergy's melody
in the pentatonic, and any pentatonic note that rubs a semitone over a chord;
everyone in key (chords, melody, answers, stammer, ladder targets, the impact,
the drop kick and sub, the tag); the band (a palette for synth, keys, drums,
bass and guitar, each heard; claps; the printer); its references (only the
five, Daft Punk always); the story; the kick pumping bass and pads; tape only
at Sink In and the stop; dry voice; filters opening the intro and closing the
outro; the wobble's share; the form in order, about 60 s, its moments where
they belong, a ladder that speeds up and climbs to the octave. On a plan: the
form and moments, the ladder, the impact on its downbeat with the drop kick,
the gap (0.37-0.42 s), nothing but her tag between the choke and BACK., her
whole tag, every note in key and in the pentatonic, a kick in every drop bar,
the tape, the loop seam. With a render: -10 ± 1 LUFS,
true peak ≤ -1 dBTP, every drop +2.5 LU over the verse on the mix and the phone,
digital silence before the impact, Whisper's windows.

Each track declares `references` (which of the five, and how), `palette` (the
band, role by role), `story` (`synergy`: what he plays, simple and a little
stiff; `synthia`: her fluent part, or `null`) and `breaks` (`{rule: why}`: the rules it breaks on
purpose, reported as warnings with the reason; a break it does not take warns
too). Today, 0 errors on all four tracks and all 488 plans of the corpus. A
track that gives Synthia no part is not warned (P7): the constitution says
Synergy learning the synth is backstory, not a feature; a Synthia part a track
names but never plays is still reported. The warnings, honestly:

- **Circle Back:** her tag plays at a fixed 1.1× and lands on C♯ (+4 cents),
  outside A minor (the new tracks tune theirs); C over G6/9 rubs a semitone
  over its B, and Synergy sings it there on every post.
- **Humbled and Honored:** a haze song (it takes Washed Out), so E-flat major
  is allowed; its home chord E♭maj9 carries the major seventh as the default
  (advice). It breaks swing on purpose (neo-soul's .24), and A♭maj9 sits
  outside the verse loop (build, Drop A, the amen).
- **Hustle:** breaks swing on purpose (2-step's .2); B♭m9 sits outside the
  verse loop in the build.
- **Offsite:** none. A haze song (Panda Bear and Washed Out), so D major is
  allowed; two chords, the verse a four-bar loop of them, no breaks.

`check-songbook` section 6 runs it on every track and on the 488 plans, and
proves it bites (140 BPM, an undeclared swing, no Kevin, no Daft Punk, a swung
ladder, E-flat major without the haze, Offsite's D major without Panda Bear
and Washed Out, the old 0.66 s wait, a quiet or noisy render).

### Renders are the same bytes (exact.js)

Two renders of the same plan are now byte-identical, in the same page or in
fresh browsers. Chromium adds a node's input connections in an order that
changes from run to run, and float addition is not associative, so with three
or more inputs sounding at once every render differed in its last bits, which
the bus compressors turned into audible LSBs (up to 16 LSB, and up to 212 LSB
at the call audio's quantizer steps). A second drift: when the last stereo
voice left a bus at a random moment (the engine's `onended` disconnects), the
filters after it re-created their kernels and lost their state.

`exact.js` fixes both without touching what the graph connects
(`check-songbook` proves the connections identical):

- Every input hears at most two connections at once; two inputs are exact
  (a + b = b + a), and a silent input adds exact zeros.
- Voices join a bus through its head, a unity gain with a fixed channel count:
  the most any of its voices has, so every bus hears the layout it always had.
- A head sums its voices on lanes: one voice per lane at a time, by its
  scheduled start and stop plus 0.5 s of tail. Lanes chain, two inputs per link.
  The busiest bus (the drums) needs about 60 lanes.
- Offline, a voice is attached to its lane at a suspend point before it starts
  and detached at one after it ends (every half second), so every graph change
  lands on the same render quantum, and the render only carries the voices that
  can sound: a 60 s render takes about 25 s instead of 78 s.
- Live, connections are placed at the end of the task that made them.

`node scripts/check-review-audio.mjs --url http://localhost:PORT` renders every
track twice in fresh browsers and compares the bytes.

### Circle Back before the song book: the proof

Before exact.js a WAV could not be byte-compared: Chromium's Web Audio summed
fan-in connections in a non-deterministic order, so two renders of the same
code, same page, differed.
Measured on today's code before any change: 422,248 of 2,672,460 frames
differ, max 16 LSB (−66 dBFS), rms 0.39 LSB; a 40-oscillator sum into one gain
node shows the same (3.6e-7), while a convolver, a compressor, a 4×
waveshaper, biquad automation, a delay curve and gain modulation are each
bit-exact. So the proof is one level up, where it is exact:

- **Plans.** 244 plans (sample post plus 60 fixtures, both forms, two
  duration models) hash identically to the code before the song book, the
  added fields aside. Peg Board: 40,356 frames of `paint()` (24 and 60 fps)
  identical to the old `choreo.js`, and `kickSteps()` identical.
- **Engine.** Through a recording `OfflineAudioContext`, the engine makes the
  identical Web Audio calls (1,958,863 across 56 renders: every node, property,
  connection, automation event, start and stop). `npm run check:songbook`
  repeats both against recorded digests.
- **Audio.** A Circle Back render after the change differs from the baseline
  by no more than two baseline renders differ from each other.

Circle Back's choke silence is 0.392 s from the end of her tag (376 ms of
exact zeros in the file), not the 510 ms the plan doc names: its measured
"Let's circle" (0.669 s, from `lady-phrases.json`) is longer than the hand
table's, so at 1.1× the tag ends at 39.608 s and the last sample sounds at
39.624 s. Aaron heard it as right; since P6 it is the wait every track keeps
(see "The wait before BACK." below).

### One word at a time (P5)

Synergy never sings two words at once, on any track:
- **No phrase runs past its slot.** `fitPhrase` used to let a phrase too long
  for its window, even at two 16ths a word, run two 16ths on (five-word hooks
  in the half-bar slots), and dropped any word past that. On fixtures 9 and 42
  the repeated hook's last word then landed on the sign-off's "Let's" (Circle
  Back and Humbled and Honored) and the build's answers ran into her ladder
  hits (every track). Now a slot that can move gives way: on Circle Back and
  Humbled and Honored the sign-off has `give:2`, so the hook runs on and lands
  its last word on the outro's downbeat, and "Let's circle back" starts an 8th
  later, its window keeping its end (Hustle's last half-bar hook has ten 16ths,
  enough for five words). Where nothing can move (the answers before her next hit) the
  shortest words are sung as single 16ths. No word is ever dropped.
- **No word sounds into the next one** (`song.js clearWords`). A word's gate
  was its steps × the 16th, but on a swung grid an odd 16th lands late, so a
  word that starts on one and lasts an odd number of 16ths ran into the next
  word by the swing: 15 ms on Circle Back, 23 ms on Hustle, 39 ms on Humbled
  and Honored (longer than the 22 ms release, so at full level). Such a word
  is now gated at the next word's onset and sped up (to 1.35× at most) to fit.
  It touches about 2.4 joins a plan and moves the verse's room trim by 0.02 dB
  at most; Circle Back's sample post keeps no trim.

`check-songbook` proves it on 366 plans (the sample and 60 fixtures, three
tracks, today's cast and the post's own, real eSpeak durations): no word
sounds past the next word's onset (stammer included), every line is sung
whole inside its window or the 16ths the next slot gives (8 lines use the
give), no line of hers is cut short by its gate (the ladder's hits are gated
to their period by design; the sink's deep half holds its bar), and
`plan.stop` is right. Its Circle Back proof is unchanged where P5 changed
nothing: 240 of the 244 plans hash as before; the 4 that changed are the two
five-word hooks in both duration models.

### The verse's room for the drops

On a phone (mono, 300 Hz to 8 kHz) the band's low end is gone, and what is
left of a drop is mostly Synergy: in the stems, his voice sits 10 to 17 dB
above the band through the phone filter. So a drop's phone lift over the verse
followed how much he sings: over 12 posts, Drop A's phone loudness correlates
with his share of Drop A at 0.87 (Circle Back) and 0.95 (Humbled and Honored),
and the mixes had been set on the sample post, whose hook fills Drop A more
than any other. A dense verse and a short hook failed the +2.5 LU gate on 8 of
11 posts on both tracks. Adding band in the drop does not move it: the drop sits
on the limiter, which takes the extra bass back out of the voice (Humbled and
Honored's 808 driven harder: +0.0 LU on the phone).

So the verse steps back by the shortfall (`drop.js roomTrim`, from the plan, so
the page and the render do the same): for each drop, k × (its reference share −
its share), plus kVerse × (the verse's share − its reference), the most any
drop needs, up to a ceiling. `track.drop.room` holds the references, set on
the post each mix was set on:

| Track | Verse | Drop A | Drop B | Max | Trim over the 61 posts |
|---|---|---|---|---|---|
| Circle Back | ref .727, k 3 | ref .458, k 8 | ref .670, k 4 | 2.5 dB | 0 on the sample, up to 1.9 dB |
| Humbled and Honored | k 0 | ref .40, k 14 | ref .55, k 4 | 2.5 dB | up to 2.5 dB |
| Hustle | k 0 | ref .30, k 4 | ref .50, k 3 | 1 dB | up to 0.3 dB |

Humbled and Honored's Drop A stabs also moved an octave up (brighter, ×1.25),
and its output and Hustle's rose to 1.36 to keep −10 LUFS with the quieter
verses. Circle Back's sample post plays exactly as before.

**Hustle, bars 26-28.** At 130 BPM "Read that again." needs nine 16ths, and the
bar-26 hook (window 14, plus its two-16th overrun) left eight at most, so her
line was lost on 35 of 61 posts. Now the hook takes 13, Synergy reads it again
from 27:10 (window 10), and the outro's hook starts at 28:8. With the real
eSpeak durations of all 61 posts (`scripts/fixtures/allhands-durations.json`)
her line is placed on every post, on every track, with today's cast and with
the post's own.

**Hustle's verses** give Synergy's consonants room: the organ's verse low-pass
is 2 kHz (was 2.8), the hats, open hats and the printer play at 0.7 under a
verse, and the keys step back to 0.5 under a sung word (was 0.6).

### Gates per track

`scripts/measure-allhands.py` with each render's plan JSON. Silence: from
`choke.tagEnd` (plus the 16 ms look-ahead) to BACK. Sample post, P5 (P4 in
brackets where it moved: one word at a time trims a few swung word ends). P6
moved only the choke and Hustle's stop line: every loudness, lift and width
figure below measured the same again, to the hundredth:

| Measure | Circle Back | Humbled and Honored | Hustle |
|---|---|---|---|
| Integrated | −10.17 LUFS | −10.16 | −10.26 (−10.27) |
| True peak | −1.10 dBTP | −1.24 | −1.09 |
| LRA | 7.1 LU | 6.2 | 7.8 |
| Drop A over verse, mix / phone | +4.60 / +2.80 (+4.64 / +2.81) | +4.81 / +3.30 | +4.54 / +2.59 (+4.53 / +2.58) |
| Drop B over verse, mix / phone | +4.68 / +3.54 (+4.71 / +3.56) | +4.62 / +3.08 | +5.80 / +4.78 (+5.78 / +4.75) |
| Her tag's end to BACK. (P6; P5 in brackets) | 0.392 s | 0.393 s (0.658) | 0.386 s (0.544) |
| Exact zeros before BACK. (P6, the file's last zero-run before the impact) | 0.386 s | 0.387 s | 0.379 s |
| Clipped samples | 0 | 0 | 0 |
| Side/mid Drop A / B (warn only) | −20.3 / −15.6 | −10.7 / −11.1 | −10.9 / −16.4 |

Over a fixed corpus of 12 posts on every track (the sample and fixtures 0, 1,
5, 13, 22, 25, 33, 38, 43, 44 and 50; today's cast), with the cold open off
and on: every gate passes, 72 of 72. The closest calls on the phone: Circle
Back +2.64 (Drop A) and +2.63 (Drop B), Humbled and Honored +2.78, Hustle
+2.58. Integrated −10.76 to −9.97 LUFS, true peak at most −1.03 dBTP. The
warnings are the side/mid width (Circle Back and Hustle's Drop B, as before) and
Humbled and Honored's loudness range on its sparsest posts (up to 8.9 LU).

### Offsite (P7)

Aaron: "lets get more of a panda bear style song... Comfy in Nautica / or
Bros... this means the video may be a bit more psychedelic pixelation."
`songbook/offsite.js` is the team retreat in the Panda Bear lane of the
constitution: the Person Pitch era's sound and approach (voices as the
instrument, loops, long reverb, hands and floors), none of its melodies,
lyrics, samples or song structures.

| | |
|---|---|
| Tempo and key | 108 BPM (a 16th is 0.139 s), swing .1 (P9; .08 before), straight from the build's third bar; D major (Ionian: a haze song may be major) |
| Harmony | Dadd9 and G6/9, I and IV: two bars each in the verse (a four-bar loop), a bar each in the build and the drops. Pat holds a D pedal under the verse. Melody on D major pentatonic (D E F♯ A B), every note on both chords. |
| Form | 27 bars, 60.0 s. Intro 0-3 (the muted call: typing, the printer, a chair, the room; it unmutes at bar 2 on "Thanks for joining"), verse 3-9, build 9-15 (her ladder from F♯3, choke 14:8.75 on the sample), BACK. at bar 15, Drop A 15-18, Sink In 18, Drop B 19-23, outro 23-27, "Full stop." at 26:8 |

**The voices.** Synergy's vocoder is the lead, dry in the verse; from the
build on his stem and hers feed a canon: two delay lines, each feeding back on
itself, two beats on the left and three on the right, so his lines come back as
a round in the drops. The pad is a wordless choir (formant-filtered saws, "oo"
in the verse, "ah" in the drops, a vibrato that blooms in and a slow tape wow
on the voices themselves; the master's wow stays an event). In Drop B a
falsetto "oo" doubles it an octave up. His four-voice choir sings every hook.

**Her ladder as a round** (`ROUND` in offsite.js). Other voices of hers join
each hit, a pentatonic step or more apart and panned round the room: in bar 9
three more enter a beat apart and sing "Let's build." whole, so four phrases
overlap; in bar 10 one more enters a beat after each hit; in bar 11 an 8th
after; from bar 12 they sing with her, a chord under her line, gated as she is. The
latest entry after her hit goes 12, 4, 2, 0, 0, 0 16ths: the round tightens
into one voice at the choke. Her stem covers 96-98% of bars 9-10 with voice.

**One loop (P9).** Aaron, on the first Offsite film: "this one can use just a
steady panda bear upbeat looping rhythm", "less of the downbeat", "a little more
slow motion". The rhythm is one bar, the same in every section from the first
bar (under the muted call) to the tape stop, and its weight is on the offbeats
(`STOMPS`, `CLAPS`, `TOMS`, `SHAKE`, `TYPE` in offsite.js):
- soft, even stomps on a wooden floor, one and three at .38, two and four at .42
  (the kick's role, settling on D2, pumping the pad and Pat; one and three pump
  a little less);
- a room of clappers on two and four (two to six people, each a few ms early or
  late, each hand its own pitch), with two hands on the "and" before each;
- floor toms on A2 and D3 rolling on the "e" and the "and" after each beat,
  never on it, and stopping two 16ths short of the next stomp;
- the printer on every 16th, leaning on the "and" and the "a" (with swing .1,
  the shuffle); keyboard clatter as the hats, on the "and"s; a mug on beat four
  every other bar.

The sections change by how much of the loop plays and how hard (`layers.loop`,
0.3 under the call to 1.15 in Drop B: how many people clap, the "e" toms, the
levels), by a second room of clappers on the "and"s of two and four in the
drops, by the voices, the filters' brightness, and the canon and the bloom. The
build's desk slaps roll on top of the loop while the drum bus high-passes it
thin; Sink In's tape slows the same loop with everything else. Nothing slams a
downbeat:
- **BACK.** is the bloom of voices alone (below). Under her word only the loop's
  heartbeat at its lightest, with no pump; Pat comes in on the "and" and the
  rest of the loop on beat two. The stomp, both floor toms and every clapper at
  once are gone.
- The floor joins on beat two of the bar the call unmutes in.
- The drone moves in runs (`runsOf`): a chord holds while it lasts, and a change
  inside a section arrives an 8th early, on the "and" of four (15 changes on
  the sample; never across the choke, into or out of Sink In). Pat's note there
  is already the next root and Kevin's "and" of four plays the new chord.
- Pat hums on the offbeats: the "and" of one and of four under the verse, and in
  the drops a walk of root, octave, fifth and the next root. Kevin's figure sits
  on the offbeats, Drop B's strum is on the "and" of one, and the choir's swell
  into Drop B lets go across the bar line, not on it.
- The drums are drier (reverb send .24 to .14): the wash belongs to the voices.
  Every stomp lands clean over the room (below), except under the slow tape's
  half-time ghost of the loop.

**BACK.** is a bloom of voices with no slam under it (no drop kick, no sub drop,
no downlifter: `band.impact`): her word as a chord of her, five copies on A3,
D4, F♯4, D3 and A4 a breath apart, then four more a beat later under her deep
echo, all into the bloom (a 7 s space that swells in over 180 ms and hears
nothing before BACK., so it opens empty). The choir swells into it. The chord
goes straight into the bloom, not through her stem, so it reads her stem's mute
(`graph.muted`, engine.js `setMuted`, P9): a drums-alone render used to carry a
7 s wash of her under every Drop A kick.

**Slow motion (P9).** A tape-slowed copy of the room (`SLOW`, `slowWindow`): one
delay line of Offsite's own whose delay grows at half the clock inside a window,
so it plays what the room played from the window's start at half speed, an
octave down (pitch = 1 - d'(t)), high-passed at 150 Hz and darkened at 2.4 kHz
like a worn tape, silent outside its windows (bit-identical to the song without
it there). No wow: that stays Sink In's and the stop's. Each window reads only
its first half, so it hears one chord, and the whole window sits under that
chord. It hears the loop's hands, the organ, the pad and Kevin (in the outro
Synergy instead of the hands), never her: the claps of its half-time ghost land
on beat three, the printer in 8ths.

| Window | Bars | What slows | Level under the mix |
|---|---|---|---|
| The second verse | 5:0-6:14 | the loop's hands, the organ and the pad, Kevin | -12.6 LU |
| The hook | 7:0-9:0 (spliced on bar 7) | the same | -12.2 LU |
| The room starts to sink | 17:8-18:0, half a bar before Sink In | the same | -9.4 LU |
| The sign-off | 25:0 to the tape stop | the organ and the pad, Kevin, Synergy's "Let's circle back" | -8.1 LU |

And her round, slowed (`ECHO`, voicesOf role `echo`): each hit of the ladder's
first two rungs comes back a dotted quarter later at half speed, an octave
down, panned wide, gone by 11:12 before the round tightens. With Sink In and
the tape stop (the whole room, as before), 19.7 s of the 60 s now run below
normal speed (33%), against 2.7 s (4%) before; 19.4-20.4 s on every fixture
post (`slowOf(plan)` lists the spans, for checks and for the picture). The
levels above are a render minus the same render with the windows off; at the
window edges and the splice no sample step exceeds the layer's own 99.5th
percentile step (no click).

**Measured (P9),** the sample post, before and after. Onset strength is
spectral flux (2048 / hop 128, 30 Hz-16 kHz) at its peak in the 60 ms after
each 16th, averaged by position; section downbeats (BACK., the unmute) apart:

| | Before | After |
|---|---|---|
| Downbeats over the 8th offbeats, mix (verse to the tape stop) | +2.8 dB | -1.0 dB |
| Downbeats over the other beats, mix | +3.2 dB | +0.1 dB |
| Downbeats over the 8th offbeats: verse, build, Drop A, Drop B, outro | +2.1, +3.4, +0.5, +5.7, +0.2 dB | -1.3, +0.5, -6.0, -1.5, -1.6 dB |
| Low end (40-160 Hz) on downbeats over the bar's mean, mix | +4.4 dB | +0.5 dB |
| Drop B's downbeat, flux | 745 | 283 |
| Low end in the 150 ms after BACK. | 45.5 dB | 34.6 dB (-10.9) |
| Bars with the whole loop (claps, the printer, toms or stomps), from the call to the stop | 21 of 27 (none in bars 0-1, 12-14, 18) | 27 of 27 |
| Each bar's onset pattern against the verse's, drums alone (correlation): Drop A, Drop B, outro, whole song | 0.09, 0.21, 0.21, 0.41 | 0.96, 0.93, 0.93, 0.78 |
| Below normal speed | 2.7 s (Sink In, the tape stop) | 19.7 s |

(Sink In reads 0.07 on the pattern: its tape slows the same loop off the grid.)
The gates on the takes (sample, cold open off and on, fixtures 15 and 47
cast by the post, and fixture 28): integrated -9.82 to -9.47 LUFS, true peak
-1.29 dBTP at most, the drops +5.00 to +7.25 LU over the verse on the mix and
+3.46 to +6.25 on the phone (the sample: Drop A +5.00 / +3.58, Drop B +5.61 /
+4.46; before +5.18 / +3.29 and +5.62 / +4.17), digital silence before BACK.
Whisper small.en hears "Let's circle back." whole on the sample (before too;
an intermediate loop with toms and a clap on BACK.'s first beat lost "back",
hence its quiet first beat). Two renders in fresh browsers: the same bytes.

**Every kick lands clean (P9).** check-videostudio-export section 3 measures
the engine's latency on every kick of the drums alone (the first sample within
40 dB of the kick's peak, from 2 ms before its step) and wants 60% within
0.5 ms of 16.33 ms. Before P9 Offsite had 40 of 72 (56%): tom and stomp tails,
the room tone on the drum bus and her BACK. chord's bloom (which ignored her
mute) sat above 1% of the kicks. Now 70 of 82 (85%), median 16.395 ms, latest
16.599 ms: the toms stop two 16ths short of a stomp, the room tone, the chair
and the printer's feed play on the keys stem (room, not kit), the bloom chord
mutes with her, the stomp's heel speaks at once (`heel`), the drums' reverb is
lower. The early ones are the 2 and 4 stomps under the slow tape's ghost, 15:8
under her deep "BACK." (the deep bus is after the tape and ignores the mutes, on
every track), Drop B's downbeat (the tape's reset) and the outro's (the fill).

**Drop A** is the clap-and-chant groove: her impact word chanted on five
16ths a bar, two voices a pentatonic third apart, stepping back 3 dB under his
words and never over her own lines. **Sink In** goes under water: the room
slides to half speed and an octave down as on every track, the tape's low-pass
closes to 650 Hz with resonance, and a 0.95 Hz wow rides the varispeed; her
deep "sink in" sits on top, dry: from her "Let that" to the end of the bar
she sends nothing to the canon or the bloom. The loop plays on under the tape
(only its first stomp is a kick: the tape delays the rest). **Drop B** is the
wall: the chant under him, the falsetto, his choir, the canon at its widest,
the loop at its fullest, the room clapping on the 8ths into the outro. **The
outro** winds down to the drone and the office (typing, the printer, a mug) on
a thinning loop and the slow tape, and the tape stops under "Full stop.".

**What it is made of.** Everything is synthesized in the browser
(`instruments.js`: `stomp` (P9: `heel`, how fast its knock speaks), `floorTom`, `gangClap`, `keyClick`, `mug`,
`creak`, `roomTone`, `printerFeed`, `voicePad`, `harmonium`, `humBass`,
`washImpulse`), plus her own recordings (`public/phrases`, the cast's files,
which the page already loads) and Synergy's eSpeak words. Nothing else: `public/`
holds full mixes and voice beds of other pieces (`studio-2/audio`,
`studio/rooms`, `studio/season`, `audio/releases`), nothing usable as loop
material, and the meeting room's office sounds are code (`src/audio.js`
`office-key`, `office-printer`), whose recipes the keyboard and printer here
follow, made deterministic.

**Exact renders.** Two things Offsite does that no track did before had to be
made exact. A param sums its own value and its inputs in an order that changes
from run to run (the pad's detune had vibrato and wow: three terms), so the two
are mixed first and each detune has one input. And Chromium breaks a feedback
loop where the graph first pulls it: a loop with two exits (the first canon,
two cross-coupled lines) broke in a different place each run, shifting its echo
by a render quantum, so each line now feeds back on itself with one exit.

### Checks and renders

- `npm run check:songbook`: the proof above, the wait before BACK. and the
  loop seam on 488 plans (P7: four tracks), the constitution's lint on every track and plan,
  every track scheduled against a
  validating fake context, and the plan fields per track.
- `npm run check:allhands` adds per-track invariants: the form inside 55-65 s,
  the moments in order, the ladder on the grid at every rate and in key, the
  silence empty, every sung note in the scale and on its chord, the impact and
  the deep voice on the chord root, the drop kick and sub tuned, determinism,
  and the cast seam. On Offsite (P7) also the band's extra voices of hers
  (`voicesOf`): the round on the pentatonic and gone before the choke, the
  round tightening bar by bar, the chant only in the drops and never over her
  own lines, all deterministic; P9 also her round's slowed echoes (half speed,
  an octave down, gone by 11:12), the drone's pushed changes (on the "and" of
  four, never across the choke or Sink In), the slow tape's four windows (each
  under one chord) and the loop in every bar.
- `npm run check:pegboard` and `npm run check:pixel` run for every track
  (screens on time, true black, ignition, the flash governor; Pixel Text cues);
  every recast ladder cut runs on Circle Back and on Offsite.
- `node scripts/render-allhands.mjs --track hustle [--cast cast.json]` renders a track.

## Casting

**Let the post choose** (on by default) is the fourth cell of the Song
picker: performing a post picks its song and the lady's lines. `casting.js`
reads the post with a small lexicon, picks a track, then casts each of her
roles from `lady-roles.json`. The page says why in one line under the picker
("Hustle, for “fired our entire sales team”, “revenue was up 12%” and “AI
agents”. No days off.") and prints her lines in the setlist. Picking a song by
hand overrides it with today's cast: the A/B against the stock lines. The
Peg Board and the Pixel Text export read the cast from the plan, so her words
light and land on her measured boundaries.

```js
import {castSong} from './casting.js';
const {track, cast, why, line} = castSong(post, {seed, track});   // pure, deterministic, ~1.5 ms
FORMS.drop60.arrange(lyrics, durations, {track, cast});
window.__allhands.render({post, auto:true})                        // the render hook casts the same way
```

`why.track` lists the concepts that scored, with the post's own words;
`why.lady[role]` says why each line was chosen ("the post says it", a keyword,
a topic, or "nothing in the post beats today's line"). `track` forces a song
and still casts for it; `seed` only moves tie-breaks; `recast` names the roles
that left today's cast.

### The role table

`lady-roles.json` has all 57 recordings. Each lists its `topics` (the same
concepts the post is read with), `keywords`, and the roles it can play: the
words (`[first, last]` into `lady-phrases.json`), the `display`, a `craft`
rating (0-1, how well it plays the role), syllables where a role counts them,
`tracks` (where the cut fits, computed by `fits()`), `heard`: what Whisper
small.en hears in the cut alone, enveloped as the engine plays it, and for
the tag and the sink `mix`: what it hears in two bars of each song the cut
fits (the sample's band, only that cut recast) and `recall`, the share of her
words it hears in order. 209 cuts over 57 recordings; today's seven lines are
in it, flagged `default`. Alone, Whisper hears 211 of the 227 cuts and
impact words exactly and 8 more with every word ("Take away.", "the gift"). In the mix it follows
every word of 25 of 47 Circle Back sinks, 40 of 50 Humbled and Honored, 25 of
46 Hustle; of the tags 6/10, 13/18 and 5/7.

`fits(role, cut, track)` checks the numbers drop.js will use, per track:

| Role | Limits a recast must meet | Cuts |
|---|---|---|
| `ladder` | 1-3 words, ≤ 0.85 s, first word ≤ 0.30 s (her 1/8 cut; "Let's" is 0.28 s) | 15 |
| `tag` + `impact` | the impact is the tag's next word, one word of 1-2 syllables, ≤ 0.55 s and a beat minus 40 ms (0.46 / 0.55 / 0.42 s), so it clears its deep echo; the tag at drop.js's own rate (`tagRate`) heard whole within 0.64 s and leaving ≥ 0.45 s of the track's nominal choke-to-impact window (a length cap: in the song it then starts where it ends 0.392 s before BACK.) | 10 / 18 / 7 |
| `bend` | one word, 2 syllables, ≤ 0.50 s | 23 |
| `sink` | 2-4 words; the dry words fit the 7 16ths before the Sink In bar (+50 ms); the deep half, pause included, ≤ half a bar (1.00 / 1.30 / 0.92 s); the pause ≤ 0.45 s | 47 / 50 / 46 |
| `lift` | one word, 2-4 syllables, ≤ 0.70 s | 43 |
| `punct` | 1-4 words, ≤ 0.90 s | 21 |
| `stop` | 1-3 words, ≤ 0.80 s, ending on a fall (not "?" or "…") | 39 |

Counts are Circle Back / Humbled and Honored / Hustle where they differ.
On top of the limits, a tag or sink whose `mix.recall` on a song is under
0.5 is not cast in that song (11 Circle Back sinks, 1 Humbled and Honored
sink, 8 Hustle sinks and 1 Hustle tag; in Hustle "Big news." sinks to
"Bananas"), and the rest score by 0.6 + 0.4 × recall.
Today's cast is exempt and plays as shipped: its tag leaves Circle Back 0.376 s
of silence, its sink's deep half is 1.30 s, "Read that again." is 0.96 s.

### The scorer

**The song.** About 40 concepts (`CONCEPTS`), each a list of words and
phrases matched on stems, some with a pattern ("5 a.m.", "$40M", "+22%",
"isn't X. It's Y."). Each carries a weight per track: humility, gratitude,
announcements, promotions, pride, milestones and farewells for Humbled and
Honored; layoffs, AI, money, growth, the 5 a.m. grind, productivity,
momentum and shipping for Hustle; meetings, process, jargon, opinions and
strategy for Circle Back; and for Offsite (P7) the retreat (an offsite, trust
falls, hiking, journaling: 2.6), the work family ("a family", "not a company",
an office dog, a morale officer: 3.8), belonging (community, kindness,
emotional intelligence, People Operations, every Sunday: 1.7), wellness
(burnout, a 4-day work week, the empty cup, slowing down: 2.0) and good vibes
(morale, fun, joy, pizza: 1.3). Culture now leans Offsite (1.3) over Circle
Back (0.6), and "offsite" left Circle Back's meetings. A concept counts its first hit fully and
each further hit a quarter; a hit in the opening line counts 1.5 (the hook sets
the tone). Scores within 0.35 of the best are a close call, settled by the
post's hash, so similar posts spread across songs. Under 1.0 nothing is
decisive and the post is Circle Back. The line quotes the strongest cues in
the post's own spelling, joined when a word apart, then a quip from the track.

**Her lines.** A recording's relevance to the post: its whole text quoted
(+4) or the role's own words quoted (+2.5), its keywords (+1.2 a word, +2 a
phrase, at most 3.6), its topics (+0.45 a hit, at most 1.8). A line's score is
relevance × (0.4 + 0.6 craft) × the mix factor × the role's weight (tag 1.6, ladder 1.3, sink
1.1, punct 1, stop 0.9, lift and bend 0.8). Today's line holds a baseline plus
its own relevance: the moments named after their line (the sink, "Read that
again.", "Full stop.") need the post's words to move them (2.1-2.2); the
ladder and tag 1.5-1.6; bend and lift 1.4. In Circle Back "Let's circle back"
is the song's title and holds +2; in the other songs the tag is open (1.0).
A line needs 1.0 of relevance and a quote or a keyword (or, for the tag,
ladder, bend and lift, 0.7 of topic) to be a recast at all.

**Near-ties.** Lines within 0.3 of the best in a role, today's included, are
settled by the post's hash weighted by how close each is (as the songs are):
the chosen line takes the best score and the best takes its, nothing else
moves. Its reasons say so ("a close call with …").

**The copy line** never ends a quote on a function word (a cue like "Head of"
takes the post's next word: "Head of Brand"), never quotes someone's family or
health back at them, drops a lone "thank" or "day", and on Humbled and Honored
a goodbye or personal news ends "Grateful for this journey.", not "Someone is
very honored."

**A coherent set.** A beam over the roles (160 states) then pair swaps pick
the best total under the rules: no recording twice (the tag and its impact
are one recording, by design), no content word shown twice (−0.8 each), a
line that is not relevant only when today's line is taken. The impact is
always the word the tag leaves out.

Over the sample and the 60 fixtures: Circle Back 29, Humbled and Honored 14,
Hustle 17 of the fixtures (the sample is Circle Back); 1.02 recasts a post,
20 posts keep today's cast; the tag is recast 15 times, the lift 15, the
ladder 10, the bend 8, the punct 7, the sink 6, the stop once. The sample
keeps today's cast exactly: it is the flagship film. "Proud of this… TEAM."
is still the tag on 5 posts: on 4 of them it is the only line the post is
about (scores 2.2 to 5.3 against today's 1.6), so only a less relevant line
could replace it; the near-tie rule moves only close calls.

`settleCast(arrange, lyrics, durations, {track, cast})` is how the page
arranges: a recast bend, lift or punct that finds no gap in Synergy's line
(real eSpeak durations can be longer than the check's models) goes back to
today's line, which is shorter or the same.

### Checks and takes

`npm run check:casting` (`scripts/check-casting.mjs`, 2 s):
- the role table against `lady-phrases.json` and `fits()`, every display
  drawable on the Peg Board and in Pixel Text as is;
- every post (sample and 60 fixtures, plus all four songs forced): files on
  disk, words inside the measured words, every recast inside its limits on
  its track, no recording twice, the impact the tag's next word, the copy one
  line without an em dash, reasons for every role, deterministic, under 20 ms;
- the distribution is not degenerate (each song 10-70% of the fixtures);
- 122 arranged plans (two duration models): every cast cut plays whole, the
  recast tags keep their silence, no role lost to a missing gap, and every
  Peg Board and Pixel Text word of hers starts on her measured boundary.

`node scripts/check-casting.mjs --render --url http://localhost:5331 --out dir`
also renders eight fixture posts through `render-allhands.mjs`, runs every
`measure-allhands.py` gate plus Whisper (small.en) on each lady moment, writes
MP3s and an `index.txt`, and checks that the page casts all 61 posts exactly
as Node does. A failed gate is rendered again with today's cast on the same
post and song: it counts against casting only if today's cast passes it.

| Fixture | Song | Recast | I / TP / LRA | Drop A, mix / phone | Drop B, mix / phone | Silence | Whisper on her recast lines |
|---|---|---|---|---|---|---|---|
| 1 | Hustle | tag, lift | −10.47 / −1.10 / 7.1 | +4.47 / +2.61 | +5.52 / +4.38 | 0.64 s | "proud of this", "Team"; "Disagree." |
| 25 | Hustle | tag | −10.49 / −1.10 / 7.8 | +4.58 / +3.01 | +5.90 / +5.17 | 0.52 s | "Nobody else will." |
| 0 | Humbled and Honored | tag, bend, lift, punct, stop | −10.82 / −1.20 / 7.1 | +5.64 / +4.30 | +5.48 / +3.63 | 0.90 s | all exact: "Honored to share.", "Journey", "Upwards", "Synergy", "is history" |
| 5 | Humbled and Honored | tag, sink | −10.89 / −1.22 / 7.5 | +5.87 / **+1.84** | +6.41 / +4.57 | 0.95 s | "Stay tuned.", "pursue new opportunities" |
| 13 | Humbled and Honored | ladder, sink, bend, punct | −10.53 / −1.30 / 6.8 | +3.44 / **+0.75** | +5.04 / +3.97 | 0.65 s | all exact: "I'm excited", "I'm thrilled to announce", "explore", "Synergy" |
| 44 | Circle Back | punct | −10.73 / −1.11 / 6.2 | +4.89 / +2.57 | +4.62 / **+2.13** | 0.38 s | "Lessons learned." |
| 38 | Hustle | ladder, bend | −10.73 / −1.26 / 7.5 | +5.11 / +3.47 | +5.70 / +4.10 | 0.53 s | "Just data.", "numbers" |
| 56 | Circle Back | tag | −10.55 / −1.10 / 6.5 | +5.04 / +2.60 | +4.88 / +3.52 | 0.69 s | "But you will." |

The three failures (bold) are the song book's on those posts: today's cast
fails the same gate there (+1.85, +1.01 and +2.17 LU). Before the mix rule,
fixture 1 sank "Agree or disagree?" (heard "Agree with Mr. Sheets") and
fixture 44 tagged "Lessons… LEARNED." (heard "Lessons. Land." in the excerpt);
both were cast again and rendered again. Clipped samples 0 and
the silence −inf dBFS in all eight. Whisper hears every recast tag with its
impact as one phrase; the impact alone, in a 0.55 s window that also holds
the drop kick and its deep echo, often reads as noise ("Well...", "2.").

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
