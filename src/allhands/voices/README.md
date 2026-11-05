# Pixel voices: Strategy and Synthia, sung

Aaron, on the new songs: "probably even less of the distorted robotic voice and
maybe just more pixelated strategy voice and perhaps Synthia." This folder is
the prototype for that: the two voices the cast already owns (Strategy is
Kokoro `am_onyx` at .95, Synthia is Flite `slt` at pitch 1.04, both exactly as
the voice bank renders them) sung onto notes in a song's key and pixelated,
without a vocoder. It is the design phase: nothing here is wired into
`/allhands/` yet. The build phase places these takes the way it places the
lady's phrases.

Synergy's vocoder (`vocoder.js`) replaces the voice's own source with a saw
carrier and keeps only its envelope: the timbre is the carrier's buzz, which is
what reads as "distorted robotic". The pixel chain keeps the speaker's own
voice (its excitation and its formants) and lowers its resolution on three
axes, the way pixelation lowers an image's: time (the spectrum moves in held
frames), sample rate (a blocky waveform, aliased) and amplitude (coarse steps).
The pitch is placed on notes like a hard retune, one note per syllable, so a
line can wander through a melody.

## What renders here, offline

| | Status |
|---|---|
| Kokoro (Strategy) | Works. `kokoro-js` 1.2.1 and `@huggingface/transformers` 3.8.1 are installed; the q8 weights were not cached (`~/.cache/huggingface` holds only faster-whisper `base.en` and `small.en`; `node_modules/@huggingface/transformers/.cache` does not exist). The renderer downloads them once from the Hugging Face hub (open weights, no key, as production's `server/local-announcer.js` does on first use) into the cache given by `--models`. The model, tokenizer, config and `am_onyx` voice data hash exactly to the voice bank's approved Strategy identity (`public/studio/voices/recordings.json`); the renderer refuses to run if they do not. About 1 s per take on this CPU. |
| Flite (Synthia) | Works. There is no `flite` binary; FFmpeg 6.1.1 is built with libflite (the `lavfi flite` source), which is what `scripts/render-meeting-season.py` uses. `slt` is 16 kHz; the renderer applies the season's pitch chain at 24 kHz (asetrate x1.04, tempo restored) and resamples to 44.1 kHz. |
| eSpeak NG 1.51 (Synergy) | Installed; not used here. |
| Word timing | Works: the lady's aligner (`scripts/align-lady-phrases.py`), imported unchanged: pocketsphinx 5 HMM, torchaudio 2.6 MMS_FA and WAV2VEC2_ASR_BASE_960H (checkpoints cached), faster-whisper 1.2.1 `small.en`. |
| Determinism | Re-rendering a Kokoro take and a Flite take gives byte-identical WAVs. The JS chain is pure and seeded. |
| Existing takes | None of the new vocabulary exists. Strategy has 16 Kokoro masters of 13 meeting lines ("Onboard.", "Optimize.", "Offline.", "Unlock.", "Unlock the potential.", "We'll take this offline.", "I'm humbled and honored to share a small update.", ...). Synthia has 31 catalog lines, rendered live by Flite in the season renderer, no stored masters ("Humbled and honored.", "Excited to share.", "Building.", "Unlocking.", ...). New words are rendered fresh, which works offline. |

Flite misreads four of the test words. Respellings change only what Synthia is
given to say, never the lyric (`items.js SAY`, as `lyrics.js` does for eSpeak),
each chosen by Whisper `small.en`: "Humbled to" is given as "Humbled tu" (heard
"Humble to"), "Grateful" as "Great-ful" ("Greatville"), "It's ownership" as
"It's, ownership" ("It's still nourishing"), "pivot" as "pivvot" ("bevel"; still
misheard in the response take, see Measurements).

## Files

| File | What it is |
|---|---|
| `items.js` | The test set: 12 expressions, 6 couplets, each for both voices, plus each couplet as a call (Strategy: "It's not X.") and response (Synthia: "It's Y."): 48 takes. The voices' identities and registers, the respellings. |
| `pixel.js` | The chain: pitch track, pitch marks, TD-PSOLA placement, decimation, block-floating bit reduction, the vowel mask, the ducked tape echo and chorus, and the one-knob sweep (`pixelParams(amount)`, `AMOUNTS`). Pure JS on Float32Array: it runs in Node and in the page. |
| `melody.js` | Keys, scales, registers; `wander()`, a seeded melodic walk; `lineFor()` puts one note on each syllable nucleus of a take. |
| `voice-table.js` | The loader, shaped like `lady-table.js`: `VOICE_TABLE` keyed by file, `tableFrom`, `slice`, `voiceFiles`, plus `takeOf`, `takesOf`, `coupletOf`, `trackOf` and `sing()`. |
| `song-voices.json` | The manifest (48 takes). |
| `song-voices-pitch.json` | The JS pitch track of every take (5 ms, 0.1 Hz integers), so a page need not run YIN. |
| `tambourine.js` | The synthesized tambourine. |
| `sketch.js` | The 20 s direction sketch. |
| `wav.js` | A small WAV codec (PCM16 / float32 in, PCM16 out). |
| `measure.py` | Alignment, Whisper word error, pitch against the target notes, tambourine spectra. |
| `../../../scripts/render-song-voices.mjs` | The offline renderer: bank, align, listen, measure, sketch. |

```sh
node scripts/render-song-voices.mjs --out DIR --models DIR/models          # everything
node scripts/render-song-voices.mjs --out DIR --steps bank,align            # the bank and the manifest only
node scripts/render-song-voices.mjs --out DIR --steps listen,measure --only strategy/delve,synthia/proud
```

`--out` is required (the bank, the test renders and the listening set go
there); the manifest goes to `src/allhands/voices/song-voices.json` unless
`--manifest` says otherwise. `--key` and `--scale` set where the test lines sing
(default D major pentatonic, Offsite's).

## The bank

A take is the dry voice: 44.1 kHz, mono, PCM 16-bit, trimmed to the speech (15
ms before the first frame within 45 dB of the loudest, 40 ms after the last),
3 ms and 10 ms raised-cosine edges, active speech at -20 dBFS RMS, peak at most
-1 dBFS. The pixel chain runs at song prepare time onto that song's notes and
key, so one take serves every track.

Manifest entry (`song-voices.json`), measured the way `lady-phrases.json` is:

```js
{id:'strategy/delve', file:'strategy/delve.wav', voice:'strategy', kind:'expression',  // or couplet, call, response
 item:'delve', text:'Delve.', spoken,          // spoken: only when respelled
 duration:.73, voiced:[.066, .651], f0:88.4,   // median Hz over the words
 rmsDb, gainDb,                                // gainDb brings it to the lady's -14 dBFS reference
 words:[{text:'Delve.', start:.066, end:.651, onset:.135,       // onset: the vowel's attack, put it on the beat
         syllables:[[.15, .28]],                                // vowel nuclei: where the notes go
         f0:88.4, check:'isolated', heard:'Delve'}],             // Whisper on the cut word
 method, confidence, heard,                    // aligner, boundary confidence, Whisper on the whole take
 bytes, sha256}
```

`voice-table.js` applies the lady table's reference offset (-2.9 dB) to
`gainDb`, so her phrases and these takes share one gain scale. Its keys end in
`.wav`, so `arrangeDrop(lyrics, durations, table, ...)` accepts it.

Sizes: the 48 takes are 5.83 MB (avg 1.38 s, 122 KB). Expressions average
0.97 s (86 KB), couplets 2.37 s, calls 1.52 s, responses 0.87 s.

| 100 takes | WAV PCM16 | FLAC | MP3 96k | Opus 48k |
|---|---|---|---|---|
| this test set's mix of kinds | 12.2 MB | 4.1 MB | 1.7 MB | 0.83 MB |
| all expressions (avg 0.97 s) | 8.6 MB | 2.9 MB | 1.2 MB | 0.6 MB |

For scale: the lady's 57 phrases are 9.4 MB of WAV. FLAC is lossless and
sample-exact (word times hold) and decodes in every current browser; MP3 adds
encoder delay that shifts every boundary unless it is trimmed.

## The pixel chain

`pixelate(samples, sr, {notes, amount, space})` in `pixel.js`; `sing(samples,
entry, {key, scale, melody | notes, amount})` in `voice-table.js` does it for a
bank take with its stored pitch track.

1. **Analyse.** YIN on a copy decimated to about 11 kHz (5 ms frames; the first
   dip below .3, else the global minimum below .42: Kokoro's `am_onyx` is low,
   about 88 Hz, and often creaky, and a strict threshold left half his vowels
   unvoiced); median and octave cleanup. Pitch marks on the glottal peaks of a
   1.2 kHz low-passed copy, one per period, every 1/150 s in unvoiced stretches.
2. **Place.** TD-PSOLA, one note per syllable nucleus (the HMM's vowel phones).
   Each grain is two source periods under a Hann window, re-spaced at the
   note's period, so the formants stay the speaker's while the pitch moves.
   Vowels sit flat on their notes (`keep`, the fraction of her own intonation
   left on the vowel, .14 light to .02 heavy); onsets and codas keep their
   spoken motion, transposed (`keepOutside` 1), so "lv" in "Delve" still moves
   like speech. Notes change across a `glide` of 28 to 13 ms: a staircase, not
   a slide. `step` holds the analysis position in voiced stretches for 7 to 22
   ms at a time: granular stepping, the spectrum moving in frames.
3. **Decimate.** Zero-order hold at `rate`; `antialias` (1 - amount) filters
   first, so light is clean and heavy aliases.
4. **Crush.** Bits with a shared power-of-two scale per 4 ms block, no dither:
   a coarse floating point, so the grain follows the level and quiet l, v and
   d sounds keep their shape (a fixed full-scale step turned "Humbled" into
   "Humble").
   Steps 3 and 4 land on the vowels. In consonants (unvoiced, or voiced with
   more than 22% of a 5 ms frame's energy above 3.5 kHz, as z and v)
   `consonants` of the clean placed take is mixed back.
5. **Space** (listening renders only; the engine may do it live). A tape echo
   (wow, a 2.2 kHz loop, soft saturation, a dotted 8th at 108 BPM, -16 dB)
   ducked 85% under the voice until 250 ms after it, widened by a two-voice
   chorus (11 and 16 ms, 0.31 and 0.47 Hz). The chorus is on the echo only and
   the voice stays dry and centred, so it survives a mono phone speaker: an
   8th-note echo made Whisper hear "Agree" as "A great rain", an undocked
   dotted 8th landed "Grate-" on "-ful" ("Great fight").

Steps 1 to 4 never move a sample in time, so the manifest's word boundaries
hold for the processed take.

One knob sweeps it all (`pixelParams(amount)`):

| | light (.3) | medium (.6) | heavy (.9) |
|---|---|---|---|
| sample-and-hold rate | 12.2 kHz | 9.2 kHz | 7.0 kHz |
| anti-alias before the hold | .7 | .4 | .1 |
| bits (per 4 ms block) | 10.4 | 8.8 | 7.2 |
| granular step | 7.3 ms | 14.7 ms | 22.1 ms |
| her intonation kept on the vowel | .14 | .08 | .02 |
| note glide | 27.5 ms | 20 ms | 12.5 ms |
| clean consonant mixed back | .85 | .7 | .55 |

The first sweep reached 5.4 kHz and 6 bits at heavy; Whisper lost single
words there ("Delve" as "No.", "Learnings" as "Lightning."), so heavy now stops
at 7 kHz and 7.2 bits.

Cost, in Node on this (shared) CPU over all 48 takes (66 s of audio): YIN 19
ms per second of audio; `sing()` with the stored pitch track 4 to 6.5 ms per
second of audio. A song's 20 cues of 1.5 s bake in about 0.2 s. The chain is
deterministic: the same take and options give the same samples.

## Where they sing

`items.js` registers: Strategy D2 to D3 around A2 (110 Hz, a little above his
88 Hz speaking median, as singing sits), Synthia D3 to D4 centred between F#3
and A3 (her speaking median is 180 Hz). `melody.js wander()` walks the scale
one syllable at a time: one scale step 62% of the time, two 21%, a repeat 12%
(never three in a row), three 5%, pulled back toward the centre when it strays
more than two steps, reflecting off the register's edges. A statement lands home
(tonic or fifth), a question rises, a couplet's first sentence ends open (2nd
or 6th) and its second comes home; a response starts an octave above the
call's last note, so call and response sound like one line handed across. A
one-syllable take slurs two notes on its vowel (a statement falls a step onto
its note, a question rises): held flat on one note, Strategy's "Delve." was
heard "Dove.". Lines are seeded by take id, so they are the same every render,
and chain from one phrase to the next with `from`.

## Measurements

Every take was rendered five ways onto a wandering line in D major
pentatonic (Offsite's key): dry (the bank take), sung (placed on the notes, no
pixels), light, medium, heavy; the three amounts also with the space (echo and
chorus, mixed to mono). 48 takes, 384 Whisper runs, 192 pitch-checked
renders (221 notes each way). Full tables: `DIR/report.md` and `DIR/report.json`.

**Whisper `small.en`** (whole take, 0.3 s of silence each side, beam 5,
temperature 0, the lady aligner's word matching; "game changer" equals
"game-changer", "Greatful" equals "Grateful"):

| Voice | Chain | dry | sung | light | medium | heavy |
|---|---|---|---|---|---|---|
| Strategy | no space | 0.0% (24/24 takes exact) | 1.3% (23/24) | 0.0% (24/24) | 0.0% (24/24) | 3.8% (21/24) |
| Strategy | echo and chorus | | | 0.0% (24/24) | 1.3% (23/24) | 3.8% (21/24) |
| Synthia | no space | 5.5% (21/24) | 4.1% (21/24) | 11.0% (18/24) | 17.8% (16/24) | 30.1% (12/24) |
| Synthia | echo and chorus | | | 13.7% (17/24) | 16.4% (15/24) | 21.9% (14/24) |

- Strategy holds every word at light and medium. At heavy he loses "Delve."
  ("No."), "Thoughts?" ("But...") and "It's not" ("If not") in one call.
- Synthia is the weak link, and mostly before the pixels: Flite's dry takes
  already lose "bug" ("above"), "ownership" and "pivot" ("bevel"). Pixelated,
  she loses "Delve." ("Done."), "Humbled tu announce" ("I'm going to
  announce"), "Thoughts?" ("Thanks."), "bandwidth" ("been with"), "a demotion"
  ("an emotion", every amount: the joke writes itself, but it is a miss) and
  "pivot" ("pillow"). Flite's 16 kHz diphones carry half the bandwidth of
  Kokoro's 24 kHz voice, so the same decimation costs her more.
- What fixed what: the slur on one-syllable takes (Strategy's "Delve." was
  "Dove." held flat), consonants mixed back clean and onsets and codas left
  moving (on five hard Strategy words, medium went from 3 misses to 1), the
  block-floating crush ("Humbled" kept its d, the last of them), the ducked
  echo ("Grateful", "Learnings" with space), the shorter sweep (heavy at 7 kHz,
  not 5.4).

**Pitch in key** (each syllable nucleus against its note; voiced frames within
6 dB of the nucleus' loudest; normalised autocorrelation and subharmonic
summation, neither shares code with the JS chain):

| Voice | Chain | notes | median error | 90th percentile | within 25 cents (all notes) | within 25 cents (nuclei of 60 ms or more, either estimator) |
|---|---|---|---|---|---|---|
| Strategy | sung | 114 | 4.8 c | 93 c | 100/114 | 83/89 |
| Strategy | light | 114 | 5.1 c | 29 c | 101/114 | 83/89 |
| Strategy | medium | 114 | 4.4 c | 15 c | 105/114 | 87/90 |
| Strategy | heavy | 114 | 3.4 c | 16 c | 106/114 | 87/90 |
| Synthia | sung | 107 | 3.4 c | 10 c | 106/107 | 90/91 |
| Synthia | light | 107 | 2.9 c | 8 c | 107/107 | 91/91 |
| Synthia | medium | 107 | 1.8 c | 7 c | 107/107 | 91/91 |
| Synthia | heavy | 107 | 3.5 c | 11 c | 107/107 | 91/91 |

Synthia sits on every note. Strategy's misses are short unstressed nuclei (the
article "a", "-tion", a final "-er") where Kokoro's creak (70 Hz) survives the
placement or an estimator locks onto a harmonic (the two disagree on most of
them); 2 to 5 of his 114 nuclei have no voiced frame to measure.

## The tambourine

`tambourine.js`: six jingle pairs on a frame, modal synthesis (84 damped
resonators), seeded. Each pair is two discs 0.4 to 1.1% apart (they beat: the
shimmer), seven inharmonic partials each from 3.3 to 18 kHz, ringing 85 to 45
ms; a collision is a 3-sample strike, a 1 ms high click and a 4 ms dull "chk".
A shake spreads 2 to 8 collisions per pair over 40 to 90 ms with a swish of
5-11 kHz noise; a hit adds a membrane thump (190, 310, 95 Hz) and a rattle.
`tambourinePattern()` plays 16ths leaning on the "and" (.32, .16, .78, .26),
light swing, 4 ms of timing breath, a strike on beat four every other bar.

Measured (`DIR/tambourine.json`):

| | one shake | one hit | the groove, 4 bars |
|---|---|---|---|
| spectral centroid | 7.0 kHz | 5.5 kHz | 8.6 kHz |
| energy by band, below 1k / 1-3k / 3-6k / 6-10k / 10-16k (dB of total) | -38 / -35 / -2.5 / -7 / -7 | -9 / -39 / -2.5 / -8 / -9 | -12 / -25 / -5 / -6 / -5 |
| strongest partials (Hz) | 3393, 3638, 4273, 4903, 6075, 6702, 10936, 13464 | 3393, 3601, 3881, 4187, 4783, 6158, 9885, 13025 | |
| attack | 42 ms (the swish) | 2.2 ms | |
| down 20 dB after the peak | 113 ms | 119 ms | |
| crest factor | 20 dB | 27 dB | 26 dB |

How good: it reads as jingles, not as a hi-hat or noise. Its energy sits
where a tambourine's does (3 to 16 kHz, a centroid of 7 to 8.6 kHz), the
partials are inharmonic (ratios 1, 1.07, 1.26, 1.44, 1.79, 1.98, 3.22, 3.97)
and beat, the decays are short, a shake swells and a hit snaps. Two tells
remain. There is almost nothing between 1 and 3 kHz (-35 dB), where a real
frame adds wood and the jingles' rattle, so alone it is a little thin and
bright. And every collision rings the same 84 modes, so over a bar of 16ths
the partials stand still as faint steady lines in the spectrum, where real
jingles turn on their pins and never ring the same way twice. Both are cheap
to fix (per-collision mode weights and a few cents of drift per shake; more
"chk" below 3 kHz). In the sketch it sits where Aaron asked for it, in the
background: -28.5 LUFS against the band's -15.6, 35% right, a hand
instrument over the digital.

## The sketch

`DIR/listen/sketch-offsite-20s.wav`, rendered by `sketch.js` (9 bars of 108
BPM, 20.0 s, D major, Dadd9 and G6/9 with the changes on the "and" of four).
A two-bar loop tiled as a sampled loop would be: soft stomps on the beats, four
people clapping on two and four, floor toms on the "e" and "and", the
tambourine; a pump organ drone and Pat humming the root on the offbeats, both
pumped by the stomps and dipped 5 dB under every sung word. Over it Synthia
(amount .4, doubled two pentatonic steps up at -14 dB, panned left) and
Strategy (.6) sing nine expressions in a line that keeps wandering from phrase
to phrase in each register (bars 1 to 4), then three couplets as call and
response, one a bar (5 to 7), then "Agree?" and "Thoughts?" (8). The dotted-8th
echo ducks under them; an 8-line room (2.8 s) behind.

Measured: -10.9 LUFS integrated, peaks at -1 dBFS; the voices' stem is 2.4 LU
over the band's (-13.2 against -15.6 LUFS). Whisper on the voices' stem alone
hears 28 of 35 words (20% WER: "Delve" is "down", "It's bandwidth" is "it's
been with"); on the full mix it drops into its music habit and keeps only the
last bars (74% WER). Each cue cut alone over the full band: 7 of 17 exact (43%
WER); in the mix, with the neighbouring cues' tails: 6 of 17 (60%). A short
word cut out of a dense loop is a hard test for Whisper, which fills it with
"Bye!" and "God."; but Strategy's lines hold up better ("North star.", "It's
not burnout.", "It's not overtime.", "Unpopular opinion." exact) than
Synthia's, the same split as the dry tests. It is a direction sketch: the
loop is busier than a verse should be, and nothing is mixed per word yet.

## For the build phase

- Publish the bank: copy `DIR/bank/*/*.wav` (or FLAC) to `public/song-voices/`
  (`voice-table.js SONG_VOICES_BASE`). Load like the lady's phrases; then
  `sing(channelData, VOICE_TABLE[file], {key, scale, melody, amount})` per cue,
  once per song, before playback.
- Place a cue by its first word's `onset` on the grid, exactly as her phrases
  are placed. `slice(entry, from, to)` cuts words.
- Echo and chorus belong in the engine's graph (a send per voice, ducked by the
  voice); the bank never bakes them.
- The melody: give `sing()` a `melody` (MIDI per syllable) from the track's
  pentatonic and its chord under each note, or let it `wander` in the voice's
  register. Synergy's melody table works the same way, one note per syllable.
- `measure.py` reuses the lady aligner as a library; if the full lexicon bank
  is rendered, run the `align` step with `--verify` for every new take.
