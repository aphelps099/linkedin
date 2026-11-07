# The Composition Constitution

Ninety percent of LinkedIn Beats music is built by these rules. The other ten percent breaks one of them on purpose, and says which.

The three tracks in this folder are the reference recordings. A new song should sit beside them without sounding like a fourth copy of them.

## The story behind the music

Between us: Synergy is learning the synth, and Synthia already plays it beautifully. That is backstory, not a feature. No song announces it, no arc has to show it, and nobody watching needs to know. It shapes how we write: Synergy's lines stay simple and a little stiff, Synthia's are the fluent ones.

Keys, Ops on drums, Kevin on guitar and Pat on bass (camera off, always) are the session players. The lady is the voice from the meeting, sampled, chopped and tuned.

## Five references, one sound

Influence means sound and approach. Never their melodies, lyrics, samples or song structures.

| Reference | What we take | Where it lives |
|---|---|---|
| **Daft Punk** | The spine. Filtered house groove, four-on-the-floor or half-time, sidechain on everything, the vocoder lead, disco guitar and bass. | Synergy's vocoder, the pump, filter sweeps, Kevin's chops. |
| **Panda Bear** | The haze of voices. Layered, looping, reverb-washed harmonies; tom-heavy patterns; delay that becomes rhythm. | The lady's ladder, the choir, the dub throws. |
| **Washed Out** | The warmth. Soft-focus pads, tape saturation and wow, nostalgia at a walking tempo. | The master's tape, the pads, Sink In. |
| **Air** | The lounge. Rhodes, Moog bass, analog strings, vocoder melancholy, room to breathe. | Keys' voicings, the slow songs. |
| **Kraftwerk** | The machine. Sequenced 16ths, minimal motifs, the robot voice, electronic percussion, clarity. | Synthia's arps, the grid, the Peg Board itself. |

## Rules

### Tempo and groove
- 90 to 130 BPM. Home is 120.
- Half-time drops are welcome. Double-time is not.
- Swing is light, 0 to .12 of a 16th, and the ladder always tightens to straight.

### Harmony
- Home is minor, Dorian or Aeolian. The haze songs (Panda Bear, Washed Out lane) may live in major or Mixolydian. Major sevenths and ninths are colour, not the default.
- Loops of two to four chords. Change the texture, not the progression.
- Melody lives in the pentatonic, so every note sits on every chord.
- Everyone is in key: Synergy, every rung of the lady's ladder, her deep voice.

### The band
- **Synth:** two players. Synthia is fluent; Synergy keeps it simple.
- **Keys:** Rhodes, organ or filtered stabs. The filter is part of the arrangement.
- **Drums (Ops):** an electronic kit with a live player's ghost notes. Claps over snares. The printer is the shaker.
- **Bass (Pat):** sub plus funk, sidechained to the kick.
- **Guitar (Kevin):** muted funk chops and clean chorus. Never a solo.

### Production
- The kick drives a sidechain pump on pads and bass.
- Tape on the master: warmth always, wow and flutter only as an event (Sink In, the tape stop).
- Reverb and delay are space, never mud. Verses stay close and dry; breakdowns wash out.
- Filters arrange the song: the intro opens up, the outro closes down.
- Wobble is a spice, not the meal.

### Forms
A song plays one form. The Drop Edition is the dance floor's: Circle Back, Humbled and Honored and Hustle. The river (`wander`) is the haze lane's: Offsite. The roll is a film's: Day One.

### Form: the Drop Edition
About 60 seconds, always in this order:
1. The muted call intro, unmuting on Synergy's welcome.
2. Verses sung from the post.
3. The lady's ladder, retriggering faster and climbing in key.
4. The choke, then true silence.
5. The impact word on the downbeat, about 0.4 s after her tag ends. Circle Back's gap is the reference.
6. A drop, Sink In (half speed, an octave down), a second drop.
7. The tape stop under the closing phrase.

### Form: the river, the haze lane's (Aaron, Nov 5)
The Panda Bear and Washed Out songs do not run the Drop Edition. They run like a river of electronic sound: it has a steady flow, and sometimes the flow gently changes. No ladder, no choke, no BACK.
- About 60 seconds. It may start sparse and ends on its fullest texture dissolving, in a long fade or the tape stop.
- Repetition is the instrument. Short samples (her syllables, Strategy's words, office sounds, the tambourine, acoustic-sounding plucks and mallets) repeat in a steady rhythmic pattern until they diffuse into a pixelated, melodic stream.
- One pattern first, alone for three bars at least; it repeats and thickens (copies, offsets, pitch steps, grains). Other samples join only once the texture is lush, around the middle, one or two a bar. Only the steady pulse runs under it from the start; the loop's other hands join as it thickens.
- Vocal fragments are texture: short grains from inside the word, never a whole word, unless the fragment is one of the clear phrases.
- Always ramp: no layer arrives or leaves in less than two bars, and none takes more than eight.
- The steady rhythmic loop runs in every bar, to the fade.
- Few clear vocal phrases: at most two of the band's, which rise out of the stream and sink back in, and Synergy at most once (his hook). Four bars at least between any two. Singers never trade phrases back to back.
- No hard section boundaries: the flow changes gently (filter, density, pan, pitch window, space), never by more than a step a bar.
- The tambourine sits in the background and comes up a little where the texture swells.
- Acoustic colours (at least two) woven through a sound that stays about 90% electronic.

#### Delve., the vocabulary film: the river's other ten percent (Aaron, Nov 6)
Delve. (`delve.js`) runs the river with two rules broken on purpose, and declares both (`breaks`):
- **Her clear phrases are the content.** Ten of them, not two: the film is about her LinkedIn vocabulary, so her phrases are the subject, not the river's few highlights. What the rule protects still holds, and the lint keeps it as a hard rule under the break: a phrase starts at least four bars after the one before, at least three bars of stream separate one phrase's end from the next one's start, each echo chain is gone a beat before the next phrase rises, and no two voices trade lines back to back (it is her film: no Strategy, Synthia or Synergy voice).
- **Two minutes, not one.** A concept film; the chart's own window (`seconds`, 110 to 130) replaces 55 to 65, and is kept.
Everything else is the river: one pattern first (her "Delve" in grains, out of its own echo), the loop in every bar, every ramp two to eight bars, the tambourine in the background, acoustic colours in a sound that stays electronic. Her arc is the song: each phrase said once crisp and dry, then handed to its echo (delay, reverb, down a fifth, down an octave, the echo to fade), the treatment growing (doubled, harmonised, on a slowing tape, shadowed, a canon) until she is the choir; the bed is her too, her own syllables stretched and stacked. She surfaces clear at the end.

### Form: the roll, a film's (Day One, Nov 7)
Day One (`src/films/day-one/score.js`, the chart `CHART`) is a short film's song, not a post's: a new hire's LinkedIn post, and two hundred people writing the same comment under it. It plays its own form, the roll, and declares three breaks (`breaks`), as Delve. does:
- **Its own form** (`form.order`): one build to the wall, then a choke and a dry line. No verses from the post, no ladder, no impact, no Sink In, no tape stop. What the rule protects still holds, and the lint keeps it as a hard rule under the break: 55 to 65 seconds, one peak (the wall, at least +2.5 LU over bars 12 to 16, on a phone too), a choke into digital silence before the last line.
- **One phrase is the whole vocal** (`form.vocal`): "Congrats on the new role!", said once by Strategy alone and dry, then sung by everyone, Strategy and Synthia answering each other the way the comments do, each copy on one note of the pentatonic in its singer's range, "role" one step down. The motif stays alone at both its statements, and Whisper hears it there.
- **A silent tail** (`form.ending`): the choke to digital silence, the motif once more (the identical samples, dry), then silence to the end.
Everything else is the constitution: the Air lane at 100 BPM, B Aeolian, Bm9 and Gmaj9, the pump from the kick, the printer on 16ths, the filter that opens the build and closes it, tape warmth with no wow, -10 LUFS.

### Mix targets
- −10 LUFS integrated, true peak −1 dBTP or lower.
- Every drop at least +2.5 LU over the verse, including on a phone speaker. On the river: every swell at least +2 LU over the stream it grew from, on a phone speaker; no silence is asked for.
- Digital silence before the impact.
- Synergy and the lady stay intelligible: Whisper must hear her lines.

## Never
- Festival EDM: supersaw hooks, build-and-drop clichés with no groove.
- Trap hi-hat rolls or brostep as the main idea.
- A melody, lyric, sample or arrangement lifted from any real song.
- A mix that only works on big speakers.
