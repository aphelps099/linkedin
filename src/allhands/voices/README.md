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

MEASUREMENTS

## The tambourine

TAMBOURINE

## The sketch

SKETCH

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
