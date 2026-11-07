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
| **Offsite** (`offsite`) | 108 BPM, D major, swing .1 (the river: .08) | 27 bars, 60.0 s | Since Nov 5 Offsite plays **the river** (`wander`, below); its Drop Edition stays arrangeable for the video studio and the older checks. Voice-loop psych pop, the Panda Bear lane (see "Offsite" below). Dadd9 · G6/9, droning, the changes pushed onto the "and" of four; voices as the instrument (her ladder as a round, her impact word as a chant, his vocoder round a two-beat canon, a wordless formant choir); one loop from the first bar to the tape stop, leaning on the offbeats (soft even stomps, a room of clappers, rolling floor toms, the printer, keyboard clatter, a mug), desk slaps into the choke; a pump organ, Pat humming the root on the offbeats, Kevin's looping clean figure; a slow tape (half speed, an octave down) under the second verse, into Sink In and under the sign-off. BACK. is a bloom of voices with no slam under it; Sink In goes under water. |

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
formOf('offsite')                             // 'wander': the form a track plays unless one is picked
FORMS.wander.arrange(lyrics, durations, {track:'offsite', cast})   // the river (wander.js, below)
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

Since Nov 5 Offsite plays the river ("The river", below; `formOf('offsite')` is
`'wander'`). What follows is its Drop Edition, which stays arrangeable
(`FORMS.drop60` with `{track:'offsite'}`, and "Drop edition" in the page's form
picker): the video studio's Offsite treatment and the older checks read it.

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
picker: performing a post picks its song, the lady's lines and the band's
vocabulary. Synergy sings the post; the band (Strategy, Synthia and the
lady's recordings) sings the lexicon (`vocabulary/LEXICON.md`,
`vocabulary/lexicon.json`). `casting.js` reads the post with a small lexicon,
picks a track, casts the band's slots from `lexicon.json` and her roles from
`lady-roles.json`. The page says why in one line under the picker, naming
the song's couplet ("Hustle, for “fired our entire sales team”, “revenue was
up 12%” and “AI agents”. It's not a hiring freeze. It's a focus season."), or
on a post about family, health or grief its refrain ("The lady's refrain:
The rest is history."). Picking a song by hand overrides it with today's cast: the A/B
against the stock lines. The Peg Board and the Pixel Text export read the cast
from the plan, so her words light and land on her measured boundaries.

```js
import {castSong} from './casting.js';
const {track, cast, why, line, keys} = castSong(post, {seed, track, recent, available});   // pure, deterministic, ~3 ms
FORMS.drop60.arrange(lyrics, durations, {track, cast});
window.__allhands.render({post, auto:true})                        // the render hook casts the same way
```

`track` forces a song and still casts for it; `seed` only moves tie-breaks;
`recent` is the songs before this one, oldest first: earlier results, their
`keys`, or `{slot:[key, ...]}` (a line one of the last 3 songs used scores
x0.15, the last 10 x0.5); `available` is the voice bank's Set of
`${voice}/${id}` takes that passed Whisper (`voices/voice-table.js`
`AVAILABLE`), or a function of a part: a line of Synthia's she did not pass
moves to Strategy, a line neither has is not cast. `why.track` lists the
concepts that scored; `why.lady[role]` and `why.band[slot]` say why each line
was chosen; `recast` names her roles that left today's cast; `keys` is what
the next song's `recent` reads; `flags` says what the post is
(`sensitive`, `layoffs`, `building`, `circleBack`, `notabout`) and what the
song did (`title`, `coupletDrop`, `itsNot`).

### The band's parts

Her roles stay as they were (`ladder`, `tag`, `impact`, `bend`, `sink`,
`lift`, `punct`, `stop`: "The cast", above). The band's ride beside them, and
`castOf` passes them through (`songbook/index.js BAND_ROLES`). A part is
`{voice, id, text, display}` for Strategy or Synthia (`id` is the take,
`vocabulary/takes.js`; the voice bank keys it `${voice}/${id}`),
`{voice:'lady', file, words:[first, last], text, display}` for her, or
`{voice:'synergy', text, display}` for his sign-off.

| Slot | Shape | What it is |
|---|---|---|
| `couplet` | `{id, topic, line, recorded, x:part, y:part}` | "It's not X." (Strategy) and "It's Y." (Synthia, or the lady when she owns the word: then `y.pickup` is Synthia's "It's" or "It's a", `its` / `its-a`). Her recorded couplets (09, 33) are hers whole. The anthem: Drop B and the outro, where the hook's later repeats were. |
| `refrain` | part | A phrase that loops and wanders: Strategy's or hers. |
| `exchanges` | `[{call:part, response:part, topics}]` | One call and its answer, two where the post asks for it (it says the line, or it is strongly on topic). Two voices, unless she answers herself ("Agree or disagree?" "Agree"). |
| `signoff` | part | The last line before the tape stop, where Synergy's "Let's circle back" was. Synergy keeps it only in Circle Back. |
| `stabs` | `[part, part]` | One word said like a verdict (or her two-word verdicts, "Milestone unlocked."), two voices where they can. |
| `dropTag` | `{kind:'lady', tag, impact}` or `{kind:'couplet', id, x, tag, impact, tracks}` | The drop. `lady`: her tag and impact, the same as `cast.tag` and `cast.impact`. `couplet`: Strategy's X over the build's first two bars, Synthia's lead-in cut off (`tag`, "IT'S A QUICK-", take `<id>-tag`), the silence, the impact (`<id>-impact`, "SYNC.", or her word when she owns it). On a couplet drop `cast.tag` and `cast.impact` still hold her best free tag, for an engine that does not place the couplet. |

Every take part and its text and display come from `lexicon.json` through
`takes.js`: `<bank id>`, `<couplet>-call`, `<couplet>-response`,
`<couplet>-tag`, `<couplet>-impact`, `its`, `its-a`, `ex-<words>`.

### Where the band sings (band.js, Nov 5)

Synergy sings the post; the band sings the lexicon in his other repeats.
`arrangeDrop` places a cast's band parts (`band.js`); today's cast (a song
picked by hand, the A/B against the stock lines) has none and arranges exactly
as before (`check-songbook` section 1).

- **His hook, at most three times** (`SYNERGY_HOOKS`): the first before the
  build, the first of Drop A and the last of Drop B (after her "Read that
  again.", which is the joke), each sung once (`slot.once`: no echo). His other
  hook slots, the build's half-bar answers and his "Let's circle back" go to the
  band (`bandSetlist`); Circle Back's title gives the sign-off back to him.
  When the couplet finds no gap and the drop is hers, he gives up his Drop A
  hook too (twice, then).
- **The couplet drop** (`cast.dropTag.kind === 'couplet'`): Strategy's "It's
  not X." over the build's answer bars (`drop.answers`, once a bar where it
  fits; her ladder steps back 4 dB under it; his answers are gone), then the
  couplet's tag where her tag was ("IT'S IN-", the start of Synthia's Y take),
  the same choke, silence and `IMPACT_GAP`, and the Y word as the impact on the
  downbeat ("DEMAND.", vocoded on the key's tonic, a deep echo a beat later),
  both cut from one take sung once, so the line runs on across the silence.
  The tag plays at the rate that leaves `LIMITS.tag.silence` of the track's
  choke window, up to `TAG_MAX_RATE` (1.25x, its notes sung lower to land in
  key); too long, and her tag plays instead (and no X).
- **The impact lands as a word** (Nov 5, `drop.js IMPACT_WORD`; Whisper heard Synthia's Y there 0 of 9
  times, and the same render with the band muted heard it). The downbeat is the word's: drums, bass, keys
  and guitar are held at 0.03 from the downbeat to 60 ms after its vowel starts (the drop kick's transient
  took its first consonant: "Bye" for VIBE., "Amen" for DEMAND.), then at 0.12 under the rest of it, and
  come back 60 ms after it over 0.16 s; its first consonant is up 6 dB; it is light pixel (at most 0.15),
  dry and centred (the tag's bus, past the stems' reverb and delay); the crash and the downlifter wait 0.2 s
  after it (right after it, the crash was heard as a plural: "Stars", "Teammates"); its deep echo starts
  0.15 s after it, a beat later at the soonest; and Synergy's Drop A hook comes in half a bar after the
  downbeat, not a beat (his "Let's" and "Kindness" were sung over the impact's tail). The drop kick, the
  sub drop and the boom still land on the downbeat, under the word.
- **Only an impact that is heard drops** (`vocabulary/impact-heard.json`, `scripts/measure-impacts.mjs`):
  every couplet that can be the drop, on each Drop Edition track it fits, in each voice the bank has its
  tag and impact in, rendered through the page on two host posts (the sample and fixture 16) and heard by
  Whisper small.en: the impact word alone, 50 ms before it to 150 ms after it, from the full mix.
  `casting.js dropVoiceOf` casts a couplet as the drop on a track only in a voice heard exactly on both
  hosts (its own first, then the other: the tag and impact move to Strategy where only his landed). The
  hosts agree on 68 of 73 renders: the moment does not depend on the post. Offsite plays the river, which
  has no drop, and is not measured.
- **The rest, in his gaps** (`placeBand`, greedy, each at the first 8th of its
  sections where it fits whole and keeps `GUARD` (60 ms) from every other
  voice, sped up to `MAX_RATE` (1.12x) at most): the sign-off where his "Let's
  circle back" was (nothing of the band after it); the couplet, X then Y a
  breath apart (or Y in the next gap, up to a bar and a half on), in Drop B,
  the outro or Drop A, or the verse when the drop is hers (when the drop is
  this couplet, its anthem is the payoff in Drop B or the outro, or nothing:
  the drop already said it; Synthia's "It's a" and the lady's word are one answer, `fit`'s `bind`: they
  wait for a gap together, never "It's a", a bar, "Pivot", as fixtures 36 and 39 had it); the refrain in
  Drop A, then up to `REFRAIN_REPEATS` (2) more times in
  the drops, each on a new path through the pentatonic (hers a scale step up
  or down); the exchange (the verse hook's free bar, then the drops); the stabs
  (the build's half-bar answers). A part that fits nowhere is left out:
  `plan.bandLeft` says which and why.
- **Sung in key.** Strategy and Synthia are the voice bank's takes, sung at
  prepare time (`lady.js prepareLady`, `voices/voice-table.js sing`) onto a
  seeded wandering line in the voice's register on the track's pentatonic,
  each note moved to what the chord under it allows; X ends open, Y comes home
  on the impact note. Her parts are her recordings, cut on her measured words
  and tuned to the nearest pentatonic note.
- **Last consonants and single words** (Nov 5). A take part that ends where its take ends plays on
  through the last word's release (`RELEASE`, 0.2 s past the aligner's end, which sits at the closure:
  "double book", "Align", "a lie", "Stakeholder" without it), lifted 8 dB from 60 ms before that end
  (`RELEASE_LIFT`); a drop's tag and Synthia's pickup stay cut off. A part of one word ("Alignment",
  "Aligned.", "Bandwidth?") is sung at light pixel (at most 0.3, `SINGLE`) and 2 dB up.
- **The mix.** The band plays on her stem (`stems.lady`: her recordings and
  the pixel voices; `stems.voice` stays Synergy's, for his mouth row), at
  `BAND_GAIN` (+6 dB over the take's speech level), `DROP_LIFT` (+3.5 dB) and a
  drums-and-bass dip in the drops. The verse's room for the drops counts the
  band at `PHONE_WEIGHT` of his share (Strategy 0.35: most of his voice is
  under a phone's 300 Hz; Synthia 0.8; her 0.7); `plan.makeup` (+0.7 dB,
  `BAND_MAKEUP`, on the output) brings a band song back to -10 LUFS.

**Plan fields** (Drop Edition, every plan; empty with today's cast):

```js
plan.band = [{                        // the band's parts, in time order
  role,                               // 'x' (the couplet drop's X), 'couplet-x', 'pickup', 'couplet-y', 'refrain',
                                      // 'call', 'response', 'stab', 'signoff'
  part,                               // the cast slot: 'dropTag', 'couplet', 'refrain', 'exchanges.0', 'stabs.1', 'signoff'
  voice,                              // 'strategy' | 'synthia' | 'lady'
  text, display, file,                // file: 'strategy/<id>.flac' (voices/voice-table.js VOICE_TABLE) or her 'NN.wav'
  key, notes, amount, midi,           // a pixel voice: the take key, its line ([{from, to, midi}], take seconds, the
                                      // notes in key before the rate), the pixel amount; her parts: midi, her tuned note
  from, to, at, rate, gate, gain, pan, dip,   // as her events (at: fractional step, the lady's clock)
  start, end,                         // seconds the part sounds (plan time)
  words:[{text, display, start, end, onset}], // each word in song seconds
  couplet, repeat,                    // the couplet's id (X, Y, pickup); a refrain's round (0, 1, 2)
}];
plan.bandLeft = [{part, why}];        // parts that found no gap
plan.drop = {kind:'couplet' | 'lady', couplet:id | null};
plan.setlist                          // Synergy's slots (band casts only)
plan.makeup                           // dB on the output (band casts only)
// On a couplet drop her tag and impact events in plan.lady are the band's:
// {role:'tag' | 'impact', voice, key, file:'synthia/<id>.flac', notes, amount, couplet, from, to, at, rate, gate, ...}
// The impact keeps her deep echo (deep, deepAt) but is dry (blend:0, vocoded:0): Synergy's vocoder,
// which her one-syllable BACK. rides, smears a word of two (Whisper heard "It's a pivot." only dry).
// It carries unmask {hold, holdFor, lead, dip, tail, boost, dry, all, after} (drop.js IMPACT_WORD; lead: its
// vowel, seconds in), which engine.js reads for the band's hold and dip, its consonant, its bus and the crash.
// A band part (and a pixel impact) that plays past its last word carries release {at, gain} (band.js RELEASE_LIFT).
```

`band.js SONG_TABLE` is `LADY_TABLE` and `VOICE_TABLE` together: an event's
words through its file, cut and rate, for the Peg Board (`/allhands/` passes
it to the stage) and the exports.

**What lands** (the sample and the 60 fixtures forced onto each Drop Edition
track, cast by the post with the voice bank's takes, real eSpeak durations;
songs out of 61):

| | Circle Back | Humbled and Honored | Hustle |
|---|---|---|---|
| A couplet heard whole (the drop's X and Y, or the anthem) | 61 | 61 | 58 |
| The couplet drops (of those cast to) | 18 (20) | 24 (24) | 26 (27) |
| The refrain | 53 | 61 | 54 |
| The sign-off (the band's; the rest Synergy's title) | 53 | 61 | 61 |
| An exchange | 23 | 41 | 33 |
| A stab | 60 | 58 | 60 |
| His hook three times / twice (he gave Drop A to the couplet) | 47 / 14 | 61 / 0 | 61 / 0 |

Circle Back, at 120 BPM with the most of Synergy's verses, has the least room:
its exchanges find a gap on 23 posts. A couplet drop whose tag is too long for
the choke window falls back to her tag (2 of 20 on Circle Back, 1 of 27 on
Hustle).

**Heard** (Whisper small.en, beam 5, each phrase cut from the full mix). Nov 5,
before: the drop's impact word alone 0 of 9. After (the sample and fixtures 11
and 48 on the three Drop Edition tracks, cast by the page with the voice
bank): the impact word alone 8 of 9 (PIVOT. x2, GIFT., OFF., PLUNGE., ROUTINE.,
SEGMENT., STAR.; Strategy's GOAL. was heard "GO!"), the tag and impact
together 9 of 9. Strategy's single words (forced into the sample's cast on the
three tracks, and as the twelve takes cast them): "Aligned." 4 of 4 (was 0 of
3), "Alignment" 7 of 9 (was 0 of 3; "Align" without the release), "Optimize."
2 of 2, "Stakeholders" 2 of 2, "Offline." 2 of 3; "Ecosystem" 2 of 4 ("Ego
system"), "Bandwidth?" 0 of 1 ("Bandwith") and "It's not double-booked." 3 of 9
(heard on Humbled and Honored, "double book" on the other two) still fall
short. On the twelve takes, every cast part: 88 of 128 exact; the weak ones are
Strategy's "It's not X." over the build's ladder (5 of 13: "a Utah", "a boy")
and her rotated sinks' deep word (4 of 9).

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

**The band, and her ladder and tag** rotate as the lexicon says
(`lexicon.json` `casting`; `casting.js` `ROTATION`). A line's score in a
slot is (0.4 + relevance + 0.6 at home) x (0.6 + 0.4 craft), less 0.8 for each
content word the song already shows (the post's hook included: Synergy sings
it, the band does not sing it back), times freshness. Relevance is the line's
concepts against the post's, per topic group (a couplet's topics), the best
group plus half the next, at most 3, plus 2.5 when the post says the line
(its words, or the couplet's X or Y). Home is the track of the line's family
or topic. When nothing clears 0.7 (1.0 for the sign-off), the track's house
rotation and the lines at home in it take the slot, then the evergreen lines.
Close calls go to FNV-1a of the post, salted per slot (drop 11, ladder 12,
refrain 14, sign-off 15, exchanges 16, stabs 18, couplet 30) so the slots do
not move together: within 0.35 of the best for the drop, the ladder and the
sign-off (the closer the likelier), within 1.2 for the couplet, the refrain
and the exchanges and 1.5 for the stabs.

The order: the drop, the couplet, the refrain, her ladder, the sign-off, the
exchanges, the stabs, then her other roles (below), then her fallback tag. No
recording twice, no lexicon line twice, no take twice.

- **The drop.** Circle Back keeps its title, "Let's circle- BACK.", on one
  Circle Back song in four (by hash; the salt, 57, puts 6 of the corpus's 24
  Circle Back songs there and the sample, the flagship, on the new
  vocabulary). Elsewhere a couplet joins her tags on 40% of the posts by
  hash, or where a couplet scores 2 on topic, and the best wins; where the
  post argues "not X, it's Y" itself, the drop is a couplet.
- **The couplet.** Never at a person: a post that matches `SENSITIVE`
  (family, health, grief; the work-family joke excepted) gets no couplet in its
  drop and only meetings and metrics couplets. The ten layoff couplets aim at
  the euphemism and play only on a layoff or restructuring post (`restructuring`,
  a concept with no weight: "laid off", "fired our", "restructuring",
  "severance"; not "cut our cloud bill").
- **Her ladder.** "Let's build." only where the post is about building and
  its hook is not already the build line (the sample's "Let's keep building"
  sung by Synergy over 42 of her "Let's build." was the chorus Aaron heard).
  On one couplet drop in three her ladder is the denial itself, "It's not"
  (22 or 09, `lady-roles.json`, `couplet:true`; Whisper hears both cuts
  exactly), climbing to the choke.
- **"Let's circle back"** is said at most once a song (her 06 in any role, or
  Synergy's sign-off), and her 06 only as the title or where the post says it.
- **Synthia answers in short, clear words.** Strategy leads: the lexicon's
  refrains and calls of hers are his, and so is any line of hers over six
  syllables or with a word she lost in the prototype's Whisper runs
  (`takes.js SYNTHIA`). She keeps couplet Ys, answers, stabs of three
  syllables or fewer and sign-offs of five. A line of his the bank has only in
  her voice (`voicesFor(id)` is `['synthia']`: "Plot twist.", "This.",
  "Agentic.", "Move the needle." and the calls "It's not silence.", "It's not a
  hot desk.", "It's not a miss.") is hers, unless it leads (a refrain, the call
  of an exchange); where his confession falls to her, he answers its Y.
- **Her template**, "It's not about X. It's about Y." (22), is the refrain
  where the post argues "not X, it's Y". The refrain pool is the lexicon's
  refrains plus any line of hers or Strategy's that sings (2 to 9 syllables).

**Her other roles** (sink, punct, stop, lift, bend) rotate by the band's rules
(Nov 5: "Let that sink in" sat on 55 of 61 posts, "Read that again." 57, "Full
stop." 56, "Pivot" 49, "Leverage" 46; `casting.js LADY_ROTATION`). A line's
score: (0.4 + its relevance + 0.6 at home) x (0.4 + 0.6 craft) x the mix factor
x freshness x the role's weight (sink 1.1, punct 1, stop 0.9, lift and bend
0.8). Relevance is as before: its whole text quoted (+4), the role's own words
(+2.5), its keywords (+1.2 a word, +2 a phrase, at most 3.6), its topics (+0.45
a hit, at most 1.8). Home is the track of its family (`lexicon.json`
`casting.home`). Lines on topic (1.0 of relevance and a quote or a keyword;
bend and lift: 0.7 of topic) come first, the closer to the best (within 0.6)
the likelier; otherwise every line that plays the role, those at home in the
track x1.5 and today's x1.3, by the post's hash salted per role (41-45). A line
of the last 3 songs scores x0.15, of the last 10 x0.5 (`keys` now names her
five moments too). Only lines that keep the role's music play it: a craft of at
least 0.7 for the sink and 0.6 for the others (`lady-roles.json`: a bend word
that means a turn, a stop that falls and closes the song, a punct that makes
the repeat a joke), inside the role's limits on the track (`fits`), and a sink
whose deep half Whisper followed in that song's mix for 75% of her words (it
reads at half speed). Today's lines keep their exemptions. A beam (160 states)
then pair swaps pick the set around every recording the band took: no
recording twice, no content word shown twice (-0.8 each). `check-casting`
holds each of her moments to at most 16 songs and at least 8 lines.

**The copy line** never ends a quote on a function word (a cue like "Head of"
takes the post's next word: "Head of Brand"), never quotes someone's family or
health back at them, drops a lone "thank" or "day". Curly quotes are the
post's words only; the band's line is said plainly after them. A goodbye or
personal news on Humbled and Honored ends "Grateful for this journey.".

Over the sample and the 60 fixtures, hash only (with the corpus's history in
order), Nov 5 (the voice bank's `AVAILABLE`, as the page casts, in square
brackets): 28 drops (28) [26 (29)], 14 ladders (16), 29 refrains (31) [28 (32)],
16 sign-offs (17), 30 couplets (33) [28 (34)]; the most-used ladder on 9 posts,
drop 6, refrain 6, couplet 6 (5), sign-off 10. A couplet drops on 28 posts:
on the hash's share it is any couplet heard on the track, as likely as any
other, so a track with few couplets heard does not drop on the same one; where
the post argues "not X, it's Y" too; strongly on topic, the closest couplet
joins her tags and the best wins. "Let's build." 1 (2); "Let's circle- BACK."
6 of 24 Circle Back songs. 56 of her 57 recordings are cast (31.wav on none).
The band's parts: Strategy 221, Synthia 175, the lady 155, Synergy 2 [Strategy
235, Synthia 163, the lady 153]. Her moments rotate (hash only, bank): "Let
that sink in" on 7 of 61 (was 55), "Read that again." 15 (57), "Full stop." 9
(56), "Pivot" 6 (49), "Leverage" 8 (46); 18 sinks, 14 puncts, 13 stops, 11
bends and 17 lifts, the most-cast "Read that again." and "A calling." on 15
and 14.

`settleCast(arrange, lyrics, durations, {track, cast})` is how the page
arranges: a recast bend, lift or punct that finds no gap in Synergy's line
(real eSpeak durations can be longer than the check's models) goes back to
today's line, which is shorter or the same.

### Checks and takes

`npm run check:casting` (`scripts/check-casting.mjs`, about 10 s, 95,000 checks):
- the role table against `lady-phrases.json` and `fits()`, every display
  drawable on the Peg Board and in Pixel Text as is;
- the takes: every id in `takes.js` resolves to `lexicon.json`, every lady
  line of the lexicon sits on her measured words, every display draws;
- every post (sample and 60 fixtures, hash only and with the corpus's
  history, plus all four songs forced): her roles as before (files on disk,
  words inside the measured words, every recast inside its limits on its
  track, the impact the tag's next word) and every band part valid (the take
  exists, says what the lexicon says, Synthia only short and clear; her files
  and words exist; the drop's couplet fits the track), no recording, take or
  lexicon id twice, "Let's circle back" at most once, the line names the
  couplet or the refrain, deterministic, under 20 ms;
- (Nov 5) the corpus cast as the page casts it, with the voice bank's `AVAILABLE`, hash only and
  with history, validated part by part (every take in the bank) and held to the same limits; her five
  moments rotate (at most 16 songs a line, at least 8 lines a role, every recast at its role's craft
  floor, a sink read in its song's mix); Synthia sings a line of Strategy's only where the bank has it
  only in her voice and it does not lead; every couplet drop's impact was heard in that track's mix
  (`impact-heard.json`); Synthia's pickup and the lady's word at most 0.3 s apart, in the arranged plans
  and with the page's casts and the real eSpeak durations;
- the lexicon's limits (`casting.caps.corpus`), hash only and with history:
  no ladder on more than 12 posts, drop 10, refrain 6, couplet 8, sign-off 10;
  at least 14 ladders, 25 drops, 25 refrains; "Let's build." on 6 at most;
  "Let's circle- BACK." on one Circle Back song in four; couplet drops 25-50%;
  with history wider; the distribution printed;
- the rules: sensitive posts, layoff posts, the sample, Delve and her
  never-cast recordings in the rotation, `available` (a full bank casts as
  the static rule; without Synthia's takes Strategy sings her lines; with
  none, the lady carries the band's slots);
- 122 arranged plans (two duration models): every cast cut plays whole, the
  recast tags keep their silence, no role lost to a missing gap, and every
  Peg Board and Pixel Text word of hers starts on her measured boundary.

`node scripts/check-casting.mjs --page --url http://localhost:6021` checks
that /allhands/ casts all 61 posts exactly as Node does (hash only and with
history) and shows the sample's why line under the picker.

`node scripts/check-casting.mjs --render --url http://localhost:5331 --out dir`
also renders nine fixture posts through `render-allhands.mjs`, runs every
`measure-allhands.py` gate plus Whisper (small.en) on each lady moment, writes
MP3s and an `index.txt`, and checks that the page casts all 61 posts exactly
as Node does. A failed gate is rendered again with today's cast on the same
post and song: it counts against casting only if today's cast passes it.

The takes below were rendered with the casting before the lexicon (her roles only); the band's parts play once the engine places them.

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

## The river (wander.js, river.js, Nov 5)

Aaron, on the Panda Bear sketch: "it's probably too much vocals packed in the
panda bear sounds. We want our repetitious rhythmatic and use samples in a
repeating pattern so you get like a pixelated diffusion of sound that builds in
a beautiful melodic stream with overlays and sound textures ... Think of it as
a natural river of electronic sound." The river is the haze lane's form
(`FORMS.wander`, the constitution's "Form: the river"); Offsite plays it
(`track.form = 'wander'`, its chart `track.wander`), and any track with a
`wander` chart can.

- **No ladder, no choke, no BACK.** 27 bars, 60.0 s at 108 BPM in D major,
  phases Source 0-2, Stream 2-10, Current 10-15, Swell 15-21, Pool 21-24,
  Delta 24-27 (labels for the picture, not boundaries: nothing changes on a bar
  line).
- **Sample loops are the instrument.** A texture is a two-bar pattern of cuts
  of one voice (her ladder's words, Strategy's word, the couplet's "It's not
  X."), each hit pitched onto the pentatonic, rendered once in JS
  (`river.js renderTexture`: the same samples in Node and every browser),
  pixelated (pixel.js: sample-and-hold and the shared-exponent crush) and
  looped on the grid. Grains, not words (Nov 5: Whisper heard fixture 31's
  loops as "drop, drop, drop" in 42 of 43 windows): every hit plays half a
  16th (about 70 ms) from inside its word, past the onset, a pentatonic step
  from the last, with two to five smeared grains round it, into the
  diffusion; the words themselves are heard only in the clear phrases.
- **The bloom** (Nov 5: it opened as a groove, loop, drone, tambourine, bass
  and plucks all in within six bars). One pattern first: her syllables (in
  over bars 0-2) over the soft pulse of the stomps (the loop, 1-4; its other
  hands join bar by bar, `RIVER_LOOP.from`: the printer from bar 5, the claps
  8, the toms 10, the typing 12, each over two bars). It repeats and
  thickens: her copies (3-7), the granular smear (6-10), the drone under it
  (7-11), lush by bar 12. Only then do new sounds ramp in, two a bar at most:
  Pat (10-13), the tambourine (11-14, in the background, a little later) and
  Kevin (11.5-15), the pluck and his word (12-14, 12-15), "It's not X." and
  the felt piano (13-16, 13.5-16), the mallet (15-18). Spread so the video's
  river cut (`offsite-psych`) never needs more than eight live decodes at
  once (G5): with Kevin and the felt piano both in from bar 14, bar 16 asked
  for nine on 18 of 24 cuts.
- **Every layer ramps** (`plan.layers`): it fades and its low-pass opens over
  2 to 8 bars, breathes, and leaves the same way, into the diffusion (a 6.5 s
  wash) and a dark dotted-8th delay. The flow drifts: the energy curve, each
  layer's level and filter, the pans, and the pitch window of the colours
  (D4 up to A4 at the swell and home).
- **The loop** of hands and the office (soft stomps pumping the drone and Pat,
  a room clapping on two and four, floor toms after the beats, the printer,
  typing, a mug) plays in every bar from bar 1 to the fade, the old build bars
  included: the stomps are the steady pulse from the start. **The tambourine**
  sits in the background and comes up 1.45x where the texture swells.
- **The acoustic colours**, synthesized (`river.js colourSamples`), carry the
  melodic stream: a Karplus-Strong pluck (an all-pass tuned delay line), a
  kalimba-like mallet (modes at 1, 3.93, 9.2), a felt piano (two strings,
  stretched partials, a soft hammer).
- **Few clear phrases.** The couplet's "It's Y." rises out of the stream at the
  swell (bar 17) after its "It's not X." has looped in the texture; the refrain
  rises once in the pool (bar 22); each sinks back in as its last word loops,
  low, in an echo layer. Synergy sings his hook once, early (bar 7), washed. At
  least four bars between any two; nobody trades phrases.
- **The pool** slows: a tape-slowed copy of the textures (half speed, an
  octave down) under bars 21-23.5. **The end** is the fullest texture
  dissolving in a long fade (bars 25-27).

**Plan fields** (`plan.form === 'wander'`, seconds are plan time):

```js
plan.sections                          // the phases, in bars (Source, Stream, Current, Swell, Pool, Delta)
plan.bars[i] = {index, section, chord, layers, cutoff, swing, energy}   // energy: the river's level (0..1)
plan.lines, plan.words                 // Synergy's hook, once (or nothing); plan.stutters [], plan.lady []
plan.band = plan.phrases = [{...a band part (above), clear:true, rise:[a, b], sink:[a, b]}]   // the clear phrases
plan.loops = [{id, what, voice, file, key?, notes?, amount?, text, display, cuts:[{from, to, base, text}]}]
plan.layers = [{id, kind, what, stem, source, in:[a, b], out:[c, d], inBars, outBars, level, open, shut, hp,
  gain:[[t, v]], filter:[[t, hz]], pan:[[t, p]], wash:[[t, x]], delay:[[t, x]], slow}]
  // kind: 'texture' | 'loop' | 'drone' | 'tambourine' | 'bass' | 'colour' | 'guitar'; source: a loop's id
plan.swells = [{name, from, to, ref:[a, b], bars, refBars}]   // where the texture comes up, over the stream it grew from
plan.slow = [{from, to, rate:.5, what, whole:false}]          // the pool's slow tape
plan.drifts = [{what, param, points:[[t, x]]}]                 // the pitch window, the energy
plan.choke = null; plan.call = null; plan.tape = []
plan.stop = {at, tapeEnd:null, line:null, end, display:null, fade:[a, b]}
plan.marks = {flow:0, swell, fade}     // 16ths
plan.kicks                             // the stomps, every bar from 1
plan.makeup                            // dB on the output (the river's mix)
```

`river.js levelAt(layer, t)` is a layer's level at a moment; `textureHits` the
notes a texture plays. The render hook returns `layers`, `loops`, `swells`,
`slow` and `phrases` with the plan. `tune.solo` (a list of layer ids) renders
only those layers, for measurements.

**Measured** (the sample post, a render through `/allhands/`; the solos are
`tune.solo` renders with the voices muted; Circle Back's sample for comparison):

| | The river | Circle Back |
|---|---|---|
| Clear phrases | 3 a minute (2 of the band's, Synergy once), none overlapping, 10.1 s (4.55 bars) apart at the least | |
| Layers | 15; ramps in and out 2 to 4 bars (median 3); at most 2 entering in one bar | |
| The loop alone, bar by bar against its median bar (16th onsets) | r 0.98 median, 22 of 24 bars at 0.8 or more; the full mix 0.755 | |
| Slow spectral change, steepest (24 bands, dB per 0.1 s) | 2.28 (p99 1.59) | 17.18 at BACK. (p99 3.74) |
| Short-term loudness, steepest climb / fall | 5.42 / 3.21 LU/s (the climb is Synergy's hook) | 5.95 / 6.65 LU/s |
| The tambourine | -27.95 LUFS, 17.7 LU under the mix, 0.6% of the energy, +5.7 LU in the swell over the stream | |
| The acoustic colours (plucks, felt piano, mallet, tambourine, guitar) | 9.9% of the energy: the sound stays about 90% electronic | |
| The loop / the textures | -22.9 / -15.1 LUFS (6.0% / 27.9% of the energy) | |
| Gates | -10.24 LUFS, -1.50 dBTP, LRA 11.6 LU (warn), Swell +4.56 LU and Pool +5.39 LU on a phone | |

**The bloom, measured** (Nov 5; the plans and renders of the sample and fixtures
11 and 48 through the page). Layers starting by bar 6: 3 (her texture, the
pulse, her copies), was 6; at most two new layers in any bar. Layers sounding
(over 30% of their level), bar by bar: 0 1 2 2 3 3 3 4 5 5 5 6 7 10 12 12 13 13
13 13 13 13 12 12 11 8 0 (was 0 1 3 4 5 6 6 7 7 8 9 9 9 11 12 12 13 13 13 13 13
12 12 12 11 8 0): lush around bar 13-14, the fullest at 16. Whisper on the loops
alone (`tune.solo` of the textures, Synergy muted, one-bar windows on a half-bar
hop, the clear phrases left out) hears a word of the loops in 0 of 42 windows
(the sample), 2 of 43 (fixture 11: "It's hot", from "Hot take"), 0 of 43
(fixture 48) and 0 of 43 (fixture 31), against 38 of 42 and 42 of 43 ("drop,
drop, drop") before; what it hears now is syllables ("bop, bop", "beep, beep")
and its silence hallucinations ("Thanks for watching!"). The clear phrases: 8 of
9 heard exactly (fixture 11's hook, washed, heard "Early results are
privacy."). Gates: -10.21 to -10.38 LUFS (the river's `makeup` went from 0.9 to
2 dB: the sparse opening had left it at -11.3), true peak -1.25 dBTP at most,
the swell +4.4 to +5.8 LU over the stream on a phone, the pool +3.3 to +6.8; the
loudness range is 13.3 to 14.0 LU (a warning; 11.2 to 12.2 before): the bloom
starts quieter. Renders are byte-identical in a fresh browser.

The LRA warning is the form: a river that starts sparse and ends in a long
fade spans more than a drop that holds its level. The river's clear phrases skip
her stem (they run dry over the stream), so they read `graph.muted.lady` and mute
with her. The sound check's bar-16 impact (a 70 Hz boom) plays only in the sound
check: the river has no drop.

### Delve. (her vocabulary on the river, Nov 6)

The song of the concept film on LinkedIn vocabulary (`songbook/delve.js`,
`--track delve`): ten things LinkedIn says, each said once by the voice from the
meeting, crisp and dry, then handed to the echo until she is the choir. 48 bars,
120.0 s at 96 BPM (swing .06), E Dorian: Em9 and A9sus4 two bars each, every
change an 8th early; the Pool (bars 24-32) lifts to G6/9#11 and A6/9 on the
pentatonic A B C# E F# (`pentatonicAt`), where the stars come out. It is in
`TRACKS` but not `TRACK_ORDER`: playable by id, never in a picker, never cast by
a post.

- **The setlist** (`W.setlist`; wander.js `vocabulary()`): her recordings at
  their bar and 16th (the first vowel lands on it exactly), tuned to the bar's
  pentatonic (band.js `ladyTune`), each with its stage: P1 "Delve." on delay
  (1:0, 1:3, 1:6), in reverb (1:8), down a fifth (2:0, PSOLA), down an octave
  (2:8, half-speed tape), then the echo to fade (feedback .62, the low-pass
  3.2 kHz to 350 Hz) to 4:0; P2 dry; P3 and P4 chains on "mindset." and "Y.";
  P5 doubled, "calling" stepping down B A G E; P6 harmonised in three; P7 "Let
  that" dry, "sink in" on a tape slowing to half speed as the river slows under
  it; P8 doubled with an octave-down shadow, a wow and light pixels, "of..."
  frozen on 8ths until 36:0; P9 a canon on the choir's tune, 1, 2, 4, 8 voices;
  P10 dry, alone. Each phrase and its echoes are baked once in JS
  (`vocab-stages.js bakePhrase`: dry, wet, throw) and played by the river
  (`river.js scheduleVocabulary`), not by `playLady` (the event's `own`).
- **Her choir** (`lady-choir.js`): "Momentum compounds." cut into five
  syllables at measured energy dips, PSOLA with a time map (consonants at speed,
  the vowel held by a wandering read position) and a formant shift, four of her
  (unison, a fifth below, an octave below, a fourth above; formants 0, -2, -4,
  -6 st; 4 to 9 cents apart; one shared tape wow), a two-bar chant she does not
  say until bar 38; in the Pool four of her hold "ah" (from "calling") on the
  chord. Within 5 cents of every note (check-allhands).
- **New hands** (instruments.js): a hand drum (modal skin; open, slap, bass,
  mute), a slit drum on the grid, glass chimes (one a star, `plan.stars`),
  Synergy's whole-note pad, Pat's warm legato bass, Synthia's soft arpeggio.
- **The plan the film reads**: `band` (plus stage, clarity, pixel, split,
  strike, font, k, voices, the tape's `warp`), `echoes`, `clarity`, `choir`,
  `stars {at, twinkles, density}`, `marks` (mouth 55.0, kiss 59.375, star 60.0,
  slow 71.25, swell2 85.0, canon 95.0, delta 105.0, undraw 117.5 s), `clearMax`,
  `bars[].pentatonic`, `fade`; the render hook passes them through.
- **Declared breaks** (constitution): ten clear phrases and two minutes; the
  spacing (four bars start to start, three of stream between, chains gone a beat
  before the next phrase) and the chart's own 110-130 s window stay hard rules.

Gates (scripts/measure-allhands.py, whisper-delve.py): -10.41 LUFS, true peak
-1.26 dBTP, the swells +3.45 and +3.86 LU over bars 5-12 on a phone; Whisper
hears P1-P5, "Let that" and P10 exactly, P6 at WER 0; the choir is never heard
as her line before 95 s. Two renders in fresh browsers are the same bytes.

The delivery master (`scripts/master-delve.py`, Nov 7): AAC and MP3 overshot the
-1 dBTP ceiling on a few sharp transients (the posted AAC -0.5 dBTP, the MP3
-0.9), so the shipped sound is the render with a spot gain on 17 transients only
(0.27 s in all, at most 0.94 dB, 5 ms ramps; the same samples everywhere else):
`assets/delve/delve-song.flac` and the MP3 decode at -1.3 dBTP; loudness, range,
both swells and Whisper unchanged (`assets/delve/delve-master.json`). The mix is
not touched.

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
