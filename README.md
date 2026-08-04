# Circle Back® — The Professional Phrase Organ

A satirical LinkedIn audio mixer: a 16-key phrase sampler that speaks corporate
clichés ("Humbled and honored to share", "Let's circle back", "Full stop.")
in time over a live-synthesized WebAudio drum machine — now with an upload
sampler and a clip exporter for your feed. Form CB-16 · Rev. 2026-08 ·
For internal thought leadership only.

Built from the design handoff in `design_handoff_circle_back_mixer/` —
Swiss International Style played dead straight as corporate bureaucracy.

## Run it

```sh
npm install
npm run dev
```

Then open the printed local URL. `npm run build` produces a static bundle in
`dist/` with relative paths, so it also serves from GitHub Pages —
`.github/workflows/deploy.yml` deploys `main` to Pages automatically
(enable Pages → Source: GitHub Actions in the repo settings, or trigger the
workflow manually from the Actions tab).

## How to play

- **▶ Play a random mix** — the one-button experience: rolls a random beat with
  phrases booked in, and plays it.
- **Keys** — every pad shows its keyboard letter (`1234` `qwet` `asdf` `zxcv`);
  type it (or click/tap) to speak the phrase and arm it.
- **Space** plays/pauses. **Shift+↑/↓** drives Delivery; **Shift+←/→** drives Sincerity.
- **Double-click a track name** in the sequencer to clear that track.
- **Sequencer**: click drum cells to cycle off → hit (blue) → accent (ink); click Vox
  cells to stamp the armed phrase's two-letter code; drag paints.
- **Exhibits (the sampler)**: *Submit exhibit* uploads audio files (up to five).
  Each is admitted into the record as its own sequencer row — cells cycle
  hit/accent like drums. `▸` auditions an exhibit, `×` strikes it.
- **Minute-take** records: while playing, pressed keys are stamped into the Vox row
  at the current step.
- **Registers**: drag dials vertically (Shift = fine, double-click = reset,
  wheel = ±3%). Sincerity and Delivery shape the spoken voice; **Decay** governs
  what happens to the previous phrase when a new one lands — low chokes it
  instantly, high lets it ring out in full; Tempo is 60–200 BPM.
- **Load agenda** seeds a demo pattern; **Table it** clears the grid.
- **Reorg** (`R`) calls a restructuring: a fresh musical drum pattern in a random
  meeting cadence (All-hands, Offsite, Sprint review, Town hall), sparse hits for
  your exhibits, and three-to-five phrases booked into the Vox row with breathing
  room. Synergies are realized immediately.
- **The engagement engine**: while the meeting is convened, reactions tick up,
  reposts accrue, and fake comments from the network's finest (Chad Growthman,
  VP of Vibes · Brenda Synergy, Chief People Officer) roll into the broadcast
  monitor. Every convene is a fresh post; the numbers build from zero.

## Distribution (posting to LinkedIn)

The **Distribution** bay shows the broadcast monitor: corporate blue field,
white text, white-outlined squares with white fills marking the beats in
sequence, and the triggered phrase revealed with a teletype animation —
rendered live on a 1080×1080 canvas. While taping, the monitor becomes a
director and cuts between closeup scenes: **the phrase** (big type +
engagement counters), **the pads** (the 4×4 key plate), **the cadence**
(the full beat grid), and **the comments** (the fake feed arriving in real
time). **Cut a clip** tapes it plus the master audio bus for the chosen run
of show (4/8/12 loops — ≈10/20/30s at 96 BPM, one scene per quarter) and
downloads a square video sized for a LinkedIn post; **Export audio** downloads
just the mix. The monitor also carries a live equalizer off the master bus —
in the composite view and as its own scene.

Video export uses WebCodecs + mp4-muxer to produce a real **H.264 + AAC
`thought-leadership.mp4`** (what LinkedIn, X, QuickTime, and phones expect)
wherever the browser supports those encoders (desktop Chrome/Edge); elsewhere
it falls back to MediaRecorder's best available format (usually `.webm`).
Upload the file to your feed. Tag someone who needs to hear this.

The 16 phrases ship as recorded voice lines (`public/phrases/*.wav`,
generated text-to-speech) played through WebAudio so they land in exports;
Sincerity/Delivery bend them via detune/rate. If a phrase file is missing the
app falls back to the browser's `speechSynthesis`, which browsers cannot
capture into a recording — you'd get the text on screen but not in the audio.

## Structure

```
src/
  main.jsx                 entry
  CircleBack.jsx           the mixer screen: state + lookahead scheduler + export flow
  audio.js                 CBAudio drum synth (pure WebAudio, no samples), sample/phrase
                           buffer playback, recording tap; CBVoice phrase bank + speech fallback
  exporter.js              MediaRecorder mime/extension/download helpers
  randomizer.js            the Reorg — style-based pattern randomizer
  feed.js                  the engagement engine's fake comment pool
  lexicon.js               full LinkedIn phrase bank (openers / buzzwords / AI tells / closers)
  styles.css, tokens/      design tokens as CSS custom properties
  components/
    chassis/               Unit, Masthead, Ticker, Bay, Silk, Readout, Stamp
    controls/              Button, Knob, Kbd
    pads/                  Pad, KeyPlate
    sequencer/             StepGrid
    broadcast/             Monitor (the 1080×1080 clip canvas)
public/phrases/            recorded phrase bank (01.wav … 16.wav)
design_handoff_circle_back_mixer/   original design handoff (reference)
```

Audio starts on first gesture (autoplay policy).

Circle Back® is not affiliated with your network.
