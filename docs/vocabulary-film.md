# DELVE., the vocabulary film

A two-minute film on LinkedIn vocabulary. It starts with her mouth: an outline of pop-art lips draws itself and says "Delve." The corporate lady says her words once, crisp and dry, then hands each one to its echo until she is the choir. Halfway through, the voice gets its body, blows a kiss, and the stars come out. At the end she comes back clear with "Read that again." and the film loops to DELVE.

- **Song:** "Delve." (`src/allhands/songbook/delve.js`), a river at 96 BPM in E Dorian, 48 bars and a 0.6 s tail. Locked.
- **Film:** the `delve-board` treatment (`src/videostudio/treatments/delve-board.js`), 9:16, 1080×1920, 24 fps, 2,895 frames (f0 to f2894), 120.625 s.
- **Drawn, not shot.** The whole frame is the Peg Board: 90 × 160 pegs, 12 px a peg at 1080 (`edl.boardPitch`), the same pegs at every render scale. No footage, no faces, no Pat, no Zoom or Lite-Brite marks.

## The idea

LinkedIn has a voice: the same twenty phrases, said with total conviction. Her recordings are that voice. The film takes it literally.

1. **It starts with a mouth.** In the first half second her lips draw themselves on the board, an outline only, and on f12 they say DELVE. The outline speaks every crisp phrase (P1 to P5) and, between them, silently mouths the choir that hums under the river.
2. **Then it echoes.** Aaron's DELVE example sets the grammar for the whole film: the word, its delay taps ping-ponging left and right, the reverb swelling its pegs, a fifth down (DELVE. again in blue, as big), an octave down (deeper still, sinking a row a beat) and the echo dissolving it to sockets. Every phrase weaves out the same way: once its echo is gone it eases to a dim ghost of itself while the river comes up.
3. **Then the vocabulary dissolves into music.** Doubled, harmonised, slowed on tape, shadowed, a canon. Her choir grows under her mouth as a stack of copies, one per voice.
4. **In the middle the voice gets its body.** In bar 22 a white-hot head runs round the outline, the fill scans in, the gloss pops. It mouths the choir, puckers on 23:12 and blows the first star, which lands square over her words on the exact middle of the film (f1440, 60.0 s). From there it speaks every phrase on her own recordings' level and pitch, and the night fills with stars.
5. **The climax is the canon.** Her voice splits into a ring of eight small mouths round the big one, each singing its own entry of "Momentum compounds."
6. **She surfaces clear at the end:** "Read that again." The lips smile and undraw in reverse stroke order, the board goes black for 15 frames, and the loop starts again on the mouth drawing itself.

The lips are an original drawing: a deep cupid's bow over a fuller lower lip, signal body, an outline that burns half again over the fill, a white gloss, and a Ben-Day halftone on the lower lip's lower third (every other peg at half light, the board's own dots). They are lips only, so "the lady never has a face" still holds. There is no tongue, no teeth, no eyes, and no band's mark. Every radial texture in the film is centred on the lips, which cover its centre, so no eye can form above the mouth.

## Her phrases

Ten of her 57 recordings, in this order. First frame is the frame that holds her first word (anchors.js `hitFrame`). Clarity is the song's: 1 is crisp and dry.

| | Recording | She says | First frame | Stage, in the sound | On the board |
|---|---|---|---|---|---|
| P1 | 10 | Delve. | f12 | Dry, then the chain: delay 1:0, 1:3, 1:6, reverb 1:8, a fifth down 2:0, an octave down 2:8, the echo to fade until 4:0 | DELVE. at k2, typed; three taps at half size, left, right, left, falling; the word swells on the reverb; DELVE. again in blue a fifth down, then deep an octave down, sinking a row a beat and dissolving on the fade taps; the word softens as its echo takes it |
| P2 | 31 | In today's fast-paced world… | f300 | Dry | IN TODAY'S / FAST-PACED / WORLD…, typed on her syllables; it weaves out as her choir comes in (15 s) |
| P3 | 09 | It's not about the tools. It's about the mindset. | f540 | Dry, the chain on "mindset." | IT'S NOT / ABOUT / THE TOOLS. struck in signal; the page turns to IT'S ABOUT / THE MINDSET.; MINDSET. echoes |
| P4 | 22 | It's not about X. It's about Y. | f840 | Dry, the chain on "Y." | IT'S NOT / ABOUT X. (X. struck), IT'S ABOUT / Y.; only Y. echoes, at twice its size |
| P5 | 33 | Not just a job, a calling. | f1138 | Doubled; "calling" steps down B A G E | NOT JUST / A JOB. struck / A CALLING.; A CALLING. doubled in blue a row under; CALLING. walks down in ghosts |
| P6 | 11 | A rich tapestry | f1440 | Harmonised in three | A RICH / TAPESTRY, scanline, under star 1; a blue copy up-left, a deep one down-right; the letters wobble |
| P7 | 15 | Let that sink in. | f1677 | "Let that" dry; "sink in" on a tape slowing to half speed | LET THAT typed; SINK IN. deep, grained, sinking a row a beat |
| P8 | 32 | Passionate about driving impact at the intersection of… | f1978 | Doubled, an octave-down shadow, tape wow; the cut-off "of…" frozen on the eighths until 36:0 | The bio in small print (PEG-5); then OF… frozen big, a ghost dripping under it per eighth |
| P9 | 57 | Momentum compounds. | f2279 | First entry clear, then a canon of 1, 2, 4, 8 voices | MOMENTUM / COMPOUNDS. pops in at her clarity (.78) and fades as the canon takes it, gone as its eighth voice enters |
| P10 | 18 | Read that again. | f2758 | Crisp, dry, alone | READ THAT / AGAIN., typed, white |

Her recording 32 is cut off while she is still speaking ("…intersection of"). The film keeps that as the joke: the bio never finishes.

## The rule broken on purpose

The river (`src/allhands/songbook/CONSTITUTION.md`, "Form: the river") allows a few clear phrases: the stream is the song, and words are its rare highlights. **Delve. breaks that rule on purpose: her phrases are the content.** There are ten, not two, because the film is about her vocabulary. The song declares it in `delve.js` (`breaks`), and the lint reports it as one of exactly two declared warnings. The other is the length: two minutes, not one.

What the rule protects still holds, and the lint enforces it as a hard rule under the break:
- a phrase starts at least 4 bars after the one before;
- at least 3 bars of stream separate one phrase's end from the next one's start;
- each echo chain is gone a beat before the next phrase rises;
- no two voices trade lines back to back. It is her film: no Strategy, Synthia or Synergy line.

The picture follows the same rule: one phrase on the board at a time, each phrase weaving out to a ghost once its echo is gone, and only her phrases ever lit in white at full light.

## The picture follows the song

The textures' light follows the river's arc (`arcAt`): the plan's `bars[].energy`, capped at .8 until the canon, climbing with the canon's voices to its top, held to the canon's last voice (109.4 s) and let go with the fade; halved on the slowed "sink in" (the slow span's own envelope). So the picture is brightest at the canon and the top of Swell 1, and dimmest in the Pool and on the slow line. Every look is square-edged (stepped rings in blocks of 2 pegs, or a field read in blocks at flat levels) and moves only on the song's eighths, at half time inside the slow span, so the board keeps the beat to the end. Measured on the board as the compositor paints it (`check-videostudio.mjs` section 17) and on the decoded file (`review-delve-video.py` part 7).

## The timeline

Bar:step at 96 BPM. One bar is 60 frames, one beat 15.

| Bars | Seconds | Frames | Board | Mouth | Texture | Stars |
|---|---|---|---|---|---|---|
| 0-4 | 0-10 | f0-239 | DELVE. typed (f12) and its echo chain as ghosts | The outline draws itself (f1-f11), says "Delve."; a blue shadow on the fifth, a copy on the octave | One deep ring opens out of the mouth; a band leaves it on every tap | none |
| 4-9 | 10-22.5 | f240-539 | P2, weaving out from 14.6 s | Speaks P2; from 15 s mouths the choir | Stepped rings, blue with every fourth white, travelling in (delve: going in) on the eighths | none |
| 9-14 | 22.5-35 | f540-839 | P3, THE TOOLS. struck, page turn, MINDSET. echoes | Speaks P3, mouths the choir; a stack copy for the second voice from 32.5 s | The rings reverse and flow out from the page turn, white every second band | none |
| 14-19 | 35-47.5 | f840-1139 | P4, X. struck, Y. echoes at k2 | Speaks P4 | The rings square up (bars 14-16); from bar 16 the motion tiles deal on the eighths (big pixels of 2-4 pegs) | none |
| 19-22 | 47.5-55 | f1140-1319 | P5 doubled, A JOB. struck, CALLING. steps down | Speaks P5; a third voice's copy | The top of Swell 1: two stepped fields, one up-left and one down-right of her lips, lit where one is (a moiré in square edges) | none |
| 22-24 | 55-60 | f1320-1439 | Cleared | The body arrives (trace, scanline fill, gloss); mouths the choir; the kiss on f1425, a round pucker with a small O | Eases to sockets | Star 1 leaves her lips on f1425, three ghosts in its wake |
| 24-28 | 60-70 | f1440-1679 | P6 harmonised, under star 1 | Speaks it | Star 1 lands square on f1440, one stepped ring pulsing out from it; the Pool: deep stepped rings out of her lips, low | Star 1, then one a chime (3 or 4 alive) |
| 28-31 | 70-77.5 | f1680-1859 | P7, SINK IN. sinking | Speaks it, slowing with the tape | Plasma in big pixels at four flat levels, half time; on the slow line it dims and drifts down | Up to 13 alive |
| 31-36 | 77.5-90 | f1860-2159 | P8 in small print; OF… frozen to 36:0 | Speaks it, a blue shadow mouth behind; holds a round O on the freeze; the fourth voice's copy | Plasma to the 8-fold mandala, centred on her lips, in blocks at three flat levels | 13 to 18 alive |
| 36-42 | 90-105 | f2160-2519 | P9, fading as the canon takes it | Mouths the choir, speaks P9; from 39:8 the ring: eight small mouths round the hero at its middle size, which hums the choir | The mandala climbs to the film's brightest with the canon's voices; motion tiles from bar 36; a dark lane under the ring | 18 to 25 alive |
| 42-46 | 105-115 | f2520-2759 | none | The ring closes back into one mouth by 44:0 | The canon look held to its last voice (109.4 s), then let go; the opening's deep ring closes back into the mouth | Thinning, 24 to 6 |
| 46-48 | 115-120.6 | f2760-2894 | P10 | Speaks it, smiles, undraws in reverse from 47:0 | Sockets only | The last star shrinks out by f2880; f2880-2894 is true black, the loop seam |

## Zones on the 90 × 160 board

The 9:16 safe area is x 64-944 and y 300-1440 at 1080: whole pegs in columns 6-77 and rows 25-120. Her lips sit on column 42, the middle of the safe columns, so her words and her mouth share one axis.

- **Rows 0-25 (header):** far blue stars only.
- **Rows 26-72:** her words (DELVE. in rows 27-44); their ghosts may fall to row 84, never within a peg of her lips.
- **Rows 76-119:** the mouth, its stack and the canon's ring.
- **Under row 120:** nothing brighter than a faint star.
- **Columns 6-77:** the words, every ghost of them, and the canon's ring.

Type is never green and never touches the lips, and every texture keeps a dark moat a peg wide around the words and the figures. `scripts/check-videostudio.mjs` section 17 proves all of this on every third frame.

## The sound

The song's WAV is locked (sha256 `8b335a45…`). It peaks at -1.26 dBTP, but AAC and MP3 overshoot on a few sharp transients (the tambourine's accent in the swells, her consonants in P5 and P7): the first AAC measured -0.5 dBTP. `scripts/master-delve.py` makes the delivery master, `assets/delve/delve-song.flac`: it encodes both ways exactly as they ship, finds the 4x-oversampled peaks over -1.3 dBTP and cuts only those spans in the source, by the overshoot plus 0.15 dB, with 5 ms raised-cosine ramps; it repeats until both decodes are clean. The result is 17 spans, 0.27 s of the song in all, the deepest cut 0.94 dB; outside the spans the master is the render sample for sample. Loudness, loudness range, both swells, Whisper and every section's level are unchanged (`assets/delve/delve-master.json` lists the spans and the numbers). The same render gives the same master and the same MP3, byte for byte.

## The one command (the Mac's 1080×1920 final)

Start the session as usual, then pull the branch with this film:

```bash
cd ~/Documents/GitHub/linkedin-allhands && export PATH="/opt/homebrew/bin:$PATH" && source .venv/bin/activate
git pull
```

Then render:

```bash
node scripts/export-videostudio.mjs --track delve --format 9:16 --master --gpu --aac 320k --out ~/Desktop --name delve-9x16
```

It writes two files:
- `~/Desktop/delve-9x16.mp4`;
- `~/Desktop/delve-9x16.json`, the sidecar: hashes, lint, timings, the governor's record, and the EDL that cut the film.

The file:
- **Video:** 1080×1920, 24 fps CFR, H.264 High yuv420p at 24 Mbps. `--master` is worth it here: the peg grid, the rings and the stars are fine detail.
- **Audio:** AAC-LC 320k, 48 kHz stereo, muxed by ffmpeg from `assets/delve/delve-song.flac`, the delivery master (above). Song time 0 sits 0.05 s into that file; the export knows (`RECORDED.delve.offset`).
- **Length:** 2,895 frames, 120.625 s, moov first (faststart).

`--track delve` is all it needs. It takes the plan from the song's own chart (`arrangeWander`), so every word, ghost, mouth shape and star lands on her sound, and it never renders the song again.

The flash governor is on by default. Never add `--no-governor`: it is a photosensitivity safety rule.

**The first line of output names the renderer.**
- With `--gpu`, it should name the Mac's GPU (for example "ANGLE (Apple, ANGLE Metal Renderer: Apple M...)").
- If it says SwiftShader, the GPU was not used. The render still works, on the CPU: in the cloud (4 cores) the 540×960 preview took 15.5 minutes (0.31 s a frame; the board draws in a few ms, the encoder takes the rest).

**If `--gpu` fails** with "WebGL2 is not available", try these in order:
1. Replace `--gpu` with `--headed`. This opens a real Chromium window, which the Mac's GPU always serves. Leave it alone until it finishes.
2. Drop both flags. The board-only fast path keeps the CPU render practical (about 40 minutes at 1080).

After a `--gpu` run, check the sidecar's `video.bytes`. A 1080 file under 60 MB means the hardware encoder undershot: render again without `--gpu`.

**It must match the cloud's preview.** The sidecar's `hashes.plan` and `hashes.edl` must be the ones below. The picture's bytes differ by renderer and scale; the plan and the cut do not.

- `hashes.plan`: `4a6685e00c044d6684bc0757e14eb85190fae6575cd470e30ff25190b48260a3`
- `hashes.edl`: `6dfde72da50fd230c0f5c2fe012aab4589ba5aad9e777c18afeb55d99d09a2bd` (the same at every scale)

**If you rendered an earlier version of this film, render again.** This version changes the picture throughout (the mouth from the first frame, the echo chain, the weave, the looks, the kiss, the canon's ring) and the sound's master (the spot gain).

**The cover.** LinkedIn shows the first frame as the poster unless you upload a thumbnail, and frame 0 is sockets. Upload `vocabulary-cover.png` as the video's thumbnail: f2100, her cut-off bio's OF… frozen over her lips at the centre of the stepped mandala, the stars out. To make it from your own render:

```bash
ffmpeg -v error -y -i ~/Desktop/delve-9x16.mp4 -vf "select=eq(n\,2100)" -frames:v 1 ~/Desktop/delve-cover.png
```

## Review it before Aaron sees it

### Numbers first

```bash
python3 scripts/review-delve-video.py ~/Desktop/delve-9x16.mp4 --frames ~/Desktop/delve-review
```

It prints the file, then the numbers measured on the decoded picture and sound:
- flashes: whole frame, each quadrant and each band of the board (header, words, mouth, floor);
- the loop seam and black frames;
- green pegs;
- the sound against its source: the offset, loudness and true peak (at most -1.0 dBTP, or FAIL);
- sync: her words against the program frame by frame; the mouth's opening against the program's lips; the mouth against her own sound on P1 and P10, where she is alone in the mix (best lag 0 or -1); the kiss on f1425 and star 1 over her lips on f1440;
- the picture against the song: light against loudness (r at least .5), the brightest two seconds inside the canon, the Pool and the slow line at most .85 of the canon, the swells' light in the margins, the beat's autocorrelation through Swell 2 and the canon.

Then it prints PASS or FAIL. `--frames` writes f-1, f and f+1 of the key moments as PNGs.

### Pictures

```bash
mkdir -p ~/Desktop/delve-review && cd ~/Desktop/delve-review
```

**Contact sheet** at the plan's moments:

```bash
ffmpeg -v error -y -i ~/Desktop/delve-9x16.mp4 -vf "select='eq(n\,8)+eq(n\,15)+eq(n\,72)+eq(n\,125)+eq(n\,175)+eq(n\,300)+eq(n\,600)+eq(n\,900)+eq(n\,1176)+eq(n\,1340)+eq(n\,1425)+eq(n\,1446)+eq(n\,1712)+eq(n\,2100)+eq(n\,2470)+eq(n\,2790)',scale=270:-1,tile=8x2" -frames:v 1 -fps_mode passthrough sheet.png
```

**One frame every 2 s:**

```bash
ffmpeg -v error -y -i ~/Desktop/delve-9x16.mp4 -vf "select='not(mod(n\,48))',scale=180:-1,tile=10x6" -frames:v 1 -fps_mode passthrough every2s.png
```

**The words at phone size** (390 px wide):

```bash
for f in 30 125 340 600 900 1190 1470 1740 2030 2100 2310 2790; do ffmpeg -v error -y -i ~/Desktop/delve-9x16.mp4 -vf "select=eq(n\,$f),scale=390:-1" -frames:v 1 phone-$f.png; done
```

**What cut the film.** This should list only black (`gen:color:#000000`), the governor on, 0 lint errors:

```bash
python3 -c "import json; d=json.load(open('$HOME/Desktop/delve-9x16.json')); print(sorted({c['asset'] for c in d['edl']['clips']}), d['lint'], d['governor'], d['treatment'], d['hashes']['plan'], d['hashes']['edl'])"
```

Then look at every PNG and watch the film twice: once on the Mac with headphones, once on a phone. Watch it loop once: the black seam into the mouth drawing itself should feel like a breath, not a cut.

### Craft

- [ ] **It starts with the mouth:** the outline draws itself in the first half second and says DELVE. on f12; the echo chain plays as ghosts (taps left and right, the swell, the blue fifth, the deep octave sinking and dissolving) by f240.
- [ ] **Every phrase reads** in the 390 px PNGs, one phrase at a time, white on the board, and weaves out once its echo is gone. The strikes (THE TOOLS., X., A JOB.) land after the word and before its answer, never through NOT, JUST or ABOUT.
- [ ] **The mouth is lips, not a face,** and reads as lips at phone size: no texture's centre above it (they all sit on the lips). The body arrives in bar 22, the kiss on f1425 is a round pucker, star 1 lands square over her words on f1440. It opens on her vowels and closes on M, B and P, and never runs ahead of her by more than a frame.
- [ ] **The ring** (from 39:8): eight small mouths, deep bows, open on their vowels, turning round the hero at its middle size on a dark lane, inside the safe columns; closed back into one by 44:0 (f2640).
- [ ] **The picture swells with the song:** brightest at the canon, then the top of Swell 1; the Pool and the slowed "sink in" low; every look stepping on the eighths.
- [ ] **The psychedelia is crafted:** stepped square-edged rings and fields, big flat pixels, motion tiles dealt on the eighths, never on her words.
- [ ] **The loop:** READ THAT AGAIN., the smile, the undraw, 15 frames of black, then the mouth draws itself again.

### Canon and tech

- [ ] **Flashes:** at most 3 a second, whole frame, each quadrant and each band, measured on the decoded file. The governor is on (the sidecar's `governor`).
- [ ] **No green type** (the review counts green pegs: expect none).
- [ ] **No people, no footage:** the EDL lists only `gen:color:#000000`.
- [ ] **No marks:** no Zoom or Lite-Brite marks or look-alikes; no band's logo in the lips.
- [ ] **Duration:** 120.625 s, 2,895 frames, 24/1.
- [ ] **A/V sync:** the review's offset against the FLAC is 0 ms (at most 1 ms).
- [ ] **Loudness:** about -10.4 LUFS; true peak at most -1.0 dBTP after AAC.

## What the cloud proved (Nov 7)

**The whole film at 540×960** (`--scale .5`) was rendered in the cloud on 4 CPU cores with SwiftShader (no GPU) in 15.5 minutes (930 s; 0.31 s a frame). 2,895 frames, 120.625 s, H.264 High yuv420p, AAC LC 48 kHz. 0 lint errors (one waived warning: P8's bio is cut off as she says it). The governor touched 0 frames. `review-delve-video.py` prints PASS on it:

- **Flashes,** on the decoded picture: none in the whole frame, the quadrants, the header or the floor; half a flash a second at worst in the words' and the mouth's bands (the limit is 3).
- **Seam and frames:** f2880-f2894 true black, no black frames before them, no decode errors, no green pegs.
- **Sound:** offset 0.00 ms against the FLAC; -10.4 LUFS; true peak -1.3 dBTP after AAC (it was -0.5 before the master).
- **Sync:** her words light at lag 0 against the board as painted (r .77; ±1 frame r .03 and .07), all 47 on their own frame; the mouth's opening against the program at lag 0 (r .85); against her own sound on P1 and P10, where she is alone in the mix, best at lag -1 (the mouth leads by a frame, never lags). The kiss is 35 pegs wide on f1425; star 1 lands over her lips on f1440.
- **The picture against the song:** light per second against the song's short-term loudness r = .63 (it was -.08); the brightest two seconds from 103.75 s, in the canon; the Pool .54 and the slowed "sink in" .53 of the canon's light; the side margins 2.1x and 2.3x the stream's at the tops of Swell 1 and the canon (Swell 1 was 0.5x); the beat's autocorrelation .84 over 85-107 s (it was .27 or less after 50 s).
- **The sound's master:** 17 spans, 0.27 s of the song in all, at most 0.94 dB down; AAC -1.30 and MP3 -1.31 dBTP; -10.41 LUFS, LRA 8.5, Swell 1 +3.45 LU and Swell 2 +3.85 LU on a phone (the render: +3.45 and +3.86); Whisper hears P1-P5, "Let that" and P10 exactly and P6 at WER 0, on the WAV and on the MP3; two runs give the same FLAC and MP3 bytes.
- **1080:** the grid is the same 90 × 160 pegs at every scale (12 px at 1080); the earlier cloud spot check put a CPU render at about 0.8 s a frame, about 40 minutes for the film.

## How it is built

**The song** (`src/allhands`), locked:
- `songbook/delve.js`: the chart, setlist, choir, stars and marks.
- `vocab-stages.js`: her stages, baked in plain JS.
- `lady-choir.js`: her syllables, stretched and stacked into the choir.
- `wander.js`: the setlist path; it writes `plan.band`, `plan.echoes`, `plan.choir`, `plan.stars`, `plan.clarity` and `plan.marks`.
- `scripts/master-delve.py`: the delivery master (the spot gain) and the MP3.

**The film:**
- `src/videostudio/treatments/delve-board.js`: the cut:
  - the ten phrase screens and their fx (echo ghosts, swell, harmony, wobble, grain, sink, dim);
  - `arcAt`, the river's arc the textures follow;
  - the textures (rings, twin, landing, pool, plasma, mandala, rings.back);
  - `mouthTrack` (her mouth frame by frame, the ring, the stack) and `starEvents`.
- `src/pegboard/lips.js`: the lips as whole pegs, in twelve shapes and three sizes (HERO, MID for the middle of the ring, SMALL for the ring), the Ben-Day shade, the seamless pucker. `eventVisemes` reads her mouth from her recordings' measured level and pitch (`src/allhands/lady-pitch.json`); `settle` makes every shape hold 2 frames and lead her by at most one.
- `src/pegboard/psych.js`: the `lips` (outline, trace, stack, mid) and `stars` (blown stars born whole with a wake, landing square; small ones never turn) figures; `quant` (motion on the grid), `whiten`, `under` and `halo` for every look; contour's `twin`/`twinY` (two fields, lit where one is); plasma's and mandala's `block` and `levels` (big flat pixels) and the mandala's `dip` (a dark lane); peg tiles' `tpx` and `tlevels` (the Printer Song's motion tiles in pegs).
- `src/pegboard/choreo.js`: the fx `echo` (with `grain`), `harmony` (with `word`), `wobble`, `grain`, `sink`, `dim`, `bloom` and `swell`; `pageAt`.
- `src/videostudio/edl/`: `anchors.js` (`phrase:P<n>`, `word:P<n>#k`, `echo:P<n>#k`, `star#n`, `mark:<name>`), `compile.js` (`text.ref: 'phrase:P<n>'`), `schema.js` (`boardPitch`, the cue `zone`, the psych cue's `events`).
- `src/videostudio/gl/compositor.js`: the board-only fast path.
- `src/videostudio/treatments/index.js`: `delve` in `RECORDED` and `BY_TRACK`. It is not in any picker.

**Checks:**
- `node scripts/check-videostudio.mjs`, section 17, Delve. (19 checks): anchors; words, pages and strikes on their frames; zones, the moat round the lips and the safe columns; no face; the picture swelling with the river; the beat; the weave; flashes; the mouth (from f0, the body, the kiss, star 1), its lip sync over all ten phrases, the ring; the stars; the palette.
- `node scripts/check-videostudio-export.mjs --node`: the recording's offset and plan.
- `node scripts/check-videostudio-export.mjs --only 9`: the fast path against the slow path, in Chromium.
- `node scripts/check-pegboard.mjs`: the lips, the stars and the peg tiles on the 90 × 160 board.
- `python3 scripts/review-delve-video.py FILE`: the rendered file.

## If something fails

- **Lint errors at the start** (the export refuses to run): `node scripts/check-videostudio.mjs` section 17 names the rule. Fix it in `delve-board.js`.
- **Flashes over 3 a second:** extract that second with the contact-sheet command (`between(n\,A\,B)`) and find the look. Lower its `level` keys (or its `whiten`) in `delve-board.js`. Render that span alone to check: `--span A-B --scale .5 --out /tmp/delve-check`.
- **A word or the mouth off its frame:** the words' times are the plan's (`plan.band[].words[].start`, from her measured word boundaries); the mouth is `mouthTrack` in `delve-board.js`; `check-videostudio.mjs` section 17 names the word or frame.
- **True peak over -1 dBTP after AAC** (another ffmpeg encodes a little differently): rebuild the master on that machine, `python3 scripts/master-delve.py <the song's WAV> --flac assets/delve/delve-song.flac --json assets/delve/delve-master.json`, and render again.
- **The sound is off:** if the review's offset is not 0, compare the FLAC with the sidecar's `audio.source`. To rebuild the FLAC, render the song again with `scripts/render-allhands.mjs --track delve --form wander` (it must be sha256 `8b335a45…`) and master it as above.
