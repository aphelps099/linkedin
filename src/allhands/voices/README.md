# Pixel voices: Strategy and Synthia, sung

Aaron, on the new songs: "we need to express more vocabulary... probably even
less of the distorted robotic voice and maybe just more pixelated strategy voice
and perhaps Synthia... a little tambourine in the background too." This folder
is the production bank for that: every lexicon line the band can be cast to sing
(`../vocabulary/lexicon.json`), rendered in the two voices the cast already owns
(Strategy is Kokoro `am_onyx` at .95, Synthia is Flite `slt` at pitch 1.04, both
exactly as the voice bank renders them), measured by the lady's aligner, and
kept only if Whisper `small.en` hears the take exactly once it is sung and
pixelated. The pixel chain (`pixel.js`) runs at play time, so one dry take sits
on any note of any track at any amount. The tambourine is an instrument in
`../instruments.js`.

Aaron's decisions (Nov 5) as the bank applies them:

- **Strategy leads the new lines.** He renders every line in the lexicon,
  including the ones it gives Synthia, at medium pixelation (.6).
- **Synthia answers only with short, clear words.** She stays Flite. She is a
  candidate only for a line the lexicon gives her of at most six syllables
  (casting's `SYNTHIA.max`, `vocabulary/takes.js`), and her take is kept only if
  Whisper hears it exactly at medium (.6), else at light (.3). Every Synthia line
  she does not pass is marked Strategy-only (`lines[id].strategyOnly`).
- **The lady keeps her 57 recordings.** Nothing here is hers; no ElevenLabs, no
  OpenAI, no `/api/voice`.
- **The layoff couplets stay** (they aim at the euphemism; casting keeps them on
  layoff and restructuring posts).

## The contract

What the engine and casting rely on. Everything here is stable; the numbers
come from the current bank.

### Files

| Path | What |
|---|---|
| `public/allhands/voices/<voice>/<id>.flac` | A take: FLAC, 44.1 kHz, mono, 16-bit, the dry voice trimmed to the speech (15 ms before the first frame within 45 dB of the loudest, 40 ms after the last; 3 and 10 ms raised-cosine edges), active speech at -20 dBFS RMS, peak at most -1 dBFS. Its pitch track (pixel.js `pitchTrack`, 5 ms, 0.1 Hz) rides in the Vorbis comment `PIXEL_PITCH`. Served at `/allhands/voices/<voice>/<id>.flac`. |
| `src/allhands/voices/song-voices.json` | The manifest (imported by `voice-table.js`, like `lady-phrases.json`). |

`<voice>` is `strategy` or `synthia`; `<id>` is casting's take id
(`vocabulary/takes.js`), so a take's key is `takeKey(part)`, `${voice}/${id}`:

| id | What | Who renders it |
|---|---|---|
| `<bank id>` | an expression ("proud-and-humbled", "per-my-last-email") | Strategy; Synthia too if the lexicon gives it to her and it is short |
| `<couplet>-call` | "It's not X." | Strategy |
| `<couplet>-response` | "It's Y." (the 61 couplets whose Y is not the lady's) | Strategy; Synthia if short |
| `<couplet>-tag`, `<couplet>-impact` | the drop: "It's a quick-" and "sync.", **cut** from the response take (no file of their own); before the lady's impact the tag is the `its-a` pickup, or its own take ("It's just") | as the take they are cut from |
| `its`, `its-a` | "It's", "It's a" before the lady's own Y word | both |
| `ex-<words>` | an exchange side the bank does not hold as an expression ("ex-aligned" is "Aligned.", "ex-bandwidth" is "Bandwidth?") | Strategy; Synthia if the lexicon gives it to her |

`lines.js` enumerates them from `lexicon.json` (221 lines, 56 cuts).

### The manifest (`song-voices.json`, version 2)

```js
{version:2, sampleRate:44100, base:'allhands/voices/', format:'flac',
 test:{keys:['D majorPenta', 'F minorPenta'], amounts:{strategy:[.6], synthia:[.6, .3]}, whisper},
 identity:{strategy:{...the voice bank's Kokoro hashes, matchesVoiceBank:true}, synthia:{...}},
 lines:{                                  // every line and cut: who can sing it, in preference order
   'forty-slides':..., 'layoff-launch-response':{voices:['synthia', 'strategy'], owner:'synthia'},
   'ever-evolving':{voices:['strategy'], owner:'synthia', strategyOnly:'long'},     // or 'failed': she did not pass
 },
 cuts:[{id:'hour-quick-sync-impact', voice:'synthia', kind:'impact', text:'sync.', from:'synthia/hour-quick-sync-response.flac',
        words:[3, 3], start, end, onset, ready:true}],     // ready: every word of the impact heard alone (the aligner's isolated check)
 entries:[{
   id:'layoff-launch-response', voice:'synthia', kind:'response',   // expression, call, response, tag, pickup, exchange
   text:"It's a launch.", spoken,                 // spoken: what the engine was given, only when respelled
   ask,                                           // a question: its line rises
   file:'synthia/layoff-launch-response.flac', ref:{couplet:'layoff-launch', part:'y'},
   samples, duration, voiced:[start, end],        // seconds in the file
   f0, rmsDb, gainDb,                             // median Hz; gainDb brings it to the lady's -14 dBFS reference
   amount:.6,                                     // the pixel amount Whisper verified it at
   words:[{text:'launch.', start, end, onset,     // onset: the vowel's attack, put it on the beat
           syllables:[[a, b]],                    // vowel nuclei: where the notes go
           f0, check:'isolated'}],                // Whisper on the cut word: isolated, context or fail
   confidence, method, heard,                     // aligner, boundary confidence, Whisper on the dry take
   bytes, sha256}]}
```

### The loader (`voice-table.js`, the page and Node)

```js
import {TAKE_TABLE, AVAILABLE, voicesFor, strategyOnly, takeFor, voiceFiles, loadVoices, sing, toBuffer} from './voices/voice-table.js';

AVAILABLE                       // Set of `${voice}/${id}` with a passing take or a ready cut: castSong's `available`
voicesFor('hour-quick-sync-response')   // ['synthia', 'strategy']: who can sing it, the owner's voice first
strategyOnly('ever-evolving')   // 'long' | 'failed' | false
takeFor(id, voice?)             // TAKE_TABLE[`${voice ?? voicesFor(id)[0]}/${id}`]:
                                //   {key, id, voice, kind, file, text, start, end, onset, words, gainDb, f0, amount, cut}
                                //   a cut's start/end/words are its own; cut = {from, words} (null for a take)
VOICE_TABLE[file]               // per file, shaped like LADY_TABLE (arrangeDrop accepts it): {file, id, text, voice, kind, words, f0, gainDb, amount, ...}
voiceFiles(parts)               // the files a list of TAKE_TABLE keys or {voice, id} needs

const takes = await loadVoices(voiceFiles(parts));            // page: fetches /allhands/voices/...
const takes = await loadVoices(files, {read:readVoice()});    // Node: import {readVoice} from './voices/node.js'
// Map file -> {file, entry, samples:Float32Array (44.1 kHz), sampleRate:44100, track}
```

FLAC is decoded in JS (`flac.js`, every frame's CRC checked), not by the
browser: the samples are the same in Chromium, Safari, Firefox and Node, at
44.1 kHz whatever the AudioContext's rate. A take is decoded once per page.

### The pixel chain at play time (`sing`)

```js
const sung = sing(take, {
  notes,          // [{from, to, midi}] one per syllable nucleus (melody.js notesFor / syllablesOf), or
  melody,         // MIDI per syllable (reused cyclically), or a seeded wander:
  key:'D', scale:'majorPenta', seed, end:'home',   // end: home | open | up | free; from: start next to a MIDI note
  register,       // {lo, hi, center} MIDI, default the voice's (items.js)
  amount,         // 0..1, default take.entry.amount (the verified amount; higher is unverified)
  vibrato,        // {cents, hz, after}
});
// -> {samples (same length and word times as the take), notes, sampleRate, gainDb}
const buffer = toBuffer(ctx, sung.samples, sung.sampleRate, [cut.start, cut.end]);   // optional slice with 3 ms edges
```

Pure and deterministic: the same take and options give the same samples (in
Chromium and Node alike, measured below). It never moves a sample in time, so
the manifest's word times hold for the sung take: place a cue by its first
word's `onset` on the grid, cut words with `slice(entry, from, to)` or a cut's
`start`/`end`, exactly as her phrases are placed. Echo and chorus belong in the
engine's graph (a send per voice, ducked by the voice); the bank never bakes
them (`pixelate(..., {space})` is the offline reference).

## The bank, measured

@@RATES@@

## Rendering it

```sh
node scripts/render-song-voices.mjs --out DIR --models DIR/models                 # tts, align, hear, publish
node scripts/render-song-voices.mjs --out DIR --steps tts,align,hear --only forty-slides,its-a
node scripts/render-song-voices.mjs --out DIR --steps tambourine,sketch            # the tambourine measured; the sketch from the bank
node scripts/check-song-voices.mjs
```

- **tts**: Kokoro (the voice bank's exact q8 artifact; the renderer refuses
  another) or Flite through FFmpeg's libflite, resampled with soxr, trimmed and
  levelled as above. Re-rendering gives byte-identical WAVs.
- **align**: `measure.py align --verify`, the lady's aligner imported unchanged
  (pocketsphinx HMM forced alignment, MMS_FA and WAV2VEC2 CTC cross-checks, 1 ms
  snapping, vowel onsets, Whisper on every word cut alone and in context), plus
  the HMM's vowel phones as syllable nuclei. Words the CMU dictionary lacks are
  added in its phone set (agentic, reorg, remix, async, workation, ...).
- **hear**: Whisper `small.en` (int8, beam 5, temperature 0, 0.3 s of silence
  each side) on the dry take, and on the take sung at its amount onto a seeded
  wandering line in D major pentatonic and in F minor pentatonic, through the
  play-time chain exactly (`sing()`'s path with the stored pitch track). Exact
  means every word, with the aligner's spellings ("game-changer" is "game
  changer"), "OK" for "okay", and digits read as words ("40 slides" is "Forty
  slides."). A take passes when the aligner found every word in order and all
  of those are exact.
- A line that fails walks its respellings (`items.js SAY`, each chosen by
  Whisper; the lyric never changes), one round each. Results are cached per
  take in `DIR/work`, so a new respelling renders only itself.
- **publish**: the passing takes as FLAC (FFmpeg, compression 12, bitexact,
  checked to decode in `flac.js` to the WAV's samples), the manifest, and
  `DIR/report.md` / `report.json` (every take, every spelling, what Whisper heard).

## The pixel chain

`pixelate(samples, sr, {notes, amount, analysis, space})` in `pixel.js`.

1. **Analyse.** YIN on a copy decimated to about 11 kHz (5 ms frames; the first
   dip below .3, else the global minimum below .42: Kokoro's `am_onyx` is low,
   about 88 Hz, and often creaky, and a strict threshold left half his vowels
   unvoiced); median and octave cleanup. Pitch marks on the glottal peaks of a
   1.2 kHz low-passed copy, one per period, every 1/150 s in unvoiced stretches.
   The bank stores the track, so a page skips YIN.
2. **Place.** TD-PSOLA, one note per syllable nucleus. Each grain is two source
   periods under a Hann window, re-spaced at the note's period, so the formants
   stay the speaker's while the pitch moves. Vowels sit flat on their notes
   (`keep`, the fraction of the speaker's own intonation left on the vowel, .14
   light to .02 heavy); onsets and codas keep their spoken motion, transposed,
   so "lv" in "Delve" still moves like speech. Notes change across a `glide` of
   28 to 13 ms: a staircase, not a slide. `step` holds the analysis position in
   voiced stretches for 7 to 22 ms at a time: the spectrum moving in frames.
3. **Decimate.** Zero-order hold at `rate`; `antialias` (1 - amount) filters
   first, so light is clean and heavy aliases.
4. **Crush.** Bits with a shared power-of-two scale per 4 ms block, no dither:
   a coarse floating point, so the grain follows the level and quiet l, v and
   d sounds keep their shape. Steps 3 and 4 land on the vowels; in consonants
   (unvoiced, or voiced with more than 22% of a 5 ms frame's energy above 3.5
   kHz) `consonants` of the clean placed take is mixed back.
5. **Space** (offline reference only). A ducked dotted-8th tape echo widened
   by a two-voice chorus on the echo only, so the voice stays dry and centred
   and survives a mono phone speaker.

| `pixelParams(amount)` | light (.3) | medium (.6) | heavy (.9) |
|---|---|---|---|
| sample-and-hold rate | 12.2 kHz | 9.2 kHz | 7.0 kHz |
| anti-alias before the hold | .7 | .4 | .1 |
| bits (per 4 ms block) | 10.4 | 8.8 | 7.2 |
| granular step | 7.3 ms | 14.7 ms | 22.1 ms |
| her intonation kept on the vowel | .14 | .08 | .02 |
| note glide | 27.5 ms | 20 ms | 12.5 ms |
| clean consonant mixed back | .85 | .7 | .55 |

@@COST@@

## Where they sing

`items.js` registers: Strategy D2 to D3 around A2 (110 Hz, a little above his
88 Hz speaking median, as singing sits), Synthia D3 to D4 centred between F#3
and A3 (her speaking median is 180 Hz). `melody.js wander()` walks the scale
one syllable at a time: one scale step 62% of the time, two 21%, a repeat 12%
(never three in a row), three 5%, pulled back toward the centre when it strays
more than two steps, reflecting off the register's edges. A statement lands home
(tonic or fifth), a question rises, a couplet's call ends open (2nd or 6th) and
its response comes home; start the response an octave above the call's last
note (`from`) and call and response sound like one line handed across. A
one-syllable take slurs two notes on its vowel (held flat on one note,
Strategy's "Delve." was heard "Dove."). Lines are seeded, so they are the same
every render, and chain from one phrase to the next with `from`.

## The tambourine

`instruments.js`, with the band:

```js
I.tambourine(ctx, out, t, v = .5, {kind:'shake' | 'hit', side:.35});   // a Web Audio voice, like the others
I.tambourinePattern({bars, step, swing, shakes:[.32, .16, .78, .26], hits:[12], every:2, humanize:.004, seed, from})
  // -> [{t, kind, v}]: 16ths leaning on the "and", a strike on beat four every other bar
I.renderTambourine(events, duration, {sampleRate})   // the same strikes offline, mono Float32Array
I.tambourineSamples(sampleRate, {kind, v, k})       // one strike; I.tambourineStrike(t, v, kind) says which
```

A wooden frame with six pairs of jingles and a head, modal synthesis, no
samples. Each jingle is seven damped resonators at inharmonic ratios (1, 1.43,
1.79, 2.28, 2.71, 3.2, 3.83) from a base between 2.6 and 4.4 kHz; the two discs
of a pair sit 0.4 to 1.1% apart and beat. A collision strikes both discs, each
partial by its own amount (where the discs met, how flat: no two collisions
ring alike), adds the metal-on-metal "chk" (2 to 6 ms of noise through a
resonance between 1.1 and 2.9 kHz, new each time) and knocks the frame, whose
five wooden modes (420 Hz to 2.4 kHz) give the 1 to 3 kHz body a bank of jingles
alone lacks. A shake spreads 2 to 8 collisions per pair over 40 to 90 ms under a
5-11 kHz swish; a hit adds the head (95, 190, 310 Hz), a hard knock into the
frame and every pair at once. Each strike is rendered once per AudioContext (12
variants per kind and velocity layer, the whole set drifting by up to 7 cents
between variants as jingles turn on their pins) and played up to 6 cents off
again, both chosen from its time: deterministic, and no two strikes of a bar
alike. At v 1 a shake peaks near -9 dBFS and a hit near -5 dBFS.

Measured (`render-song-voices.mjs --steps tambourine`, `DIR/tambourine.json`;
the prototype's `voices/tambourine.js` in brackets, same events):

| | one shake (v .8) | one hit (v .8) | the groove, 4 bars |
|---|---|---|---|
| spectral centroid | 5.4 kHz (7.0) | 4.3 kHz (5.5) | 5.9 kHz (8.6) |
| energy below 1k / 1-3k / 3-6k / 6-10k / 10-16k, dB of the total | -40 / **-21** / -1.5 / -7 / -10 (-38 / -35 / -2.5 / -7 / -7) | -7 / **-13** / -2.4 / -9 / -12 (-9 / -39 / -2.5 / -8 / -9) | -11 / **-11** / -3.5 / -7 / -8 (-12 / -25 / -5 / -6 / -5) |
| attack, down 20 dB after the peak | 20 ms (the swish), 174 ms | 2.0 ms, 99 ms | |

- **The body.** 1-3 kHz went from 35 to 39 dB under the total to 11 to 21 dB
  under it: the frame's knock and the "chk" now sit where a real tambourine's
  wood and rattle are, so alone it is no longer thin and bright (the centroid
  came down from 8.6 to 5.9 kHz over the groove; most of the energy is still in
  the jingles, 3 to 16 kHz).
- **No steady lines.** Over a bar of even 16ths at one velocity, the 30
  strongest lines of the long-term spectrum (3-16 kHz) stand 11.5 dB above
  their +-40 Hz neighbourhood, against 21.8 dB for the prototype, where every
  collision rang the same 84 modes. Every strike of the bar is a different
  variant and rate (`check-song-voices.mjs`), and the twelve rendered shakes of
  a layer all differ.
- Deterministic: two renders of a bar are the same samples; the Web Audio voice
  plays the same strike buffer at the same rate. A strike renders in about 15 ms
  in Node; a song's pool (two or three velocity layers) in 0.1 to 0.4 s, once.
- Placing it is the engine's: Aaron asked for it "in the background", so a
  track sends it at the level of its shaker or below, panned right of centre.

## The sketch

`sketch.js`, rendered by the `sketch` step from the published bank through
`loadVoices` (9 bars of 108 BPM, 20.0 s, D major, Dadd9 and G6/9, the changes
on the "and" of four): a two-bar loop tiled as a sampled loop would be (soft
stomps, four people clapping on two and four, floor toms on the "e" and "and",
the tambourine), a pump organ drone and Pat humming the root, both pumped by
the stomps and dipped under every sung word. Over it Strategy leads eight
expressions (proud and humbled to announce, north star, move the needle, in
this economy, trust the process) with Synthia's short answers (blessed,
learnings, and that's okay), then three couplets as call and response (an
hour / a quick sync, a reorg / a remix, an agenda / a vibe) and "Bandwidth?"
"None.". Each take at the amount Whisper verified it at.

@@SKETCH@@

## Files

| File | What it is |
|---|---|
| `lines.js` | Every lexicon line Strategy or Synthia can be cast to sing, with casting's ids, the voices that render it, and the drop cuts. |
| `items.js` | The voices' identities, registers and verified amounts; the respellings (`SAY`, `variantsOf`). |
| `voice-table.js` | The loader and `sing()` (above). |
| `node.js` | Node only: `readVoice(dir)` for `loadVoices`. |
| `flac.js` | The FLAC decoder (pure JS) and the `PIXEL_PITCH` codec. |
| `pixel.js` | The chain (pure JS on Float32Array: Node and the page). |
| `melody.js` | Keys, scales, registers; `wander()`; `lineFor()`, `notesFor()`, `syllablesOf()`. |
| `song-voices.json` | The manifest. |
| `sketch.js` | The 20 s direction sketch. |
| `wav.js` | A small WAV codec (the renderer's working format). |
| `measure.py` | Alignment, Whisper word error, pitch against target notes, tambourine spectra. |
| `../../../scripts/render-song-voices.mjs` | The offline renderer. |
| `../../../scripts/check-song-voices.mjs` | The check. |

## History: the prototype (Nov 5, before the bank)

The prototype rendered 12 expressions and 6 couplets in both voices (48 takes)
and measured the chain five ways (dry, sung, light, medium, heavy). Whisper
`small.en` word error, no space: Strategy 0% dry, 0% light, 0% medium, 3.8%
heavy; Synthia 5.5% dry, 11.0% light, 17.8% medium, 30.1% heavy (Flite's 16 kHz
diphones carry half the bandwidth of Kokoro's 24 kHz voice, so the same
decimation costs her more). Pitch in key at medium, each syllable nucleus
against its note: Strategy 105 of 114 within 25 cents (median 4.4 c; the misses
are short unstressed nuclei where his 70 Hz creak survives), Synthia 107 of 107
(median 1.8 c). That is why Strategy leads and Synthia keeps only short words
she passes; the bank re-measures every line.
