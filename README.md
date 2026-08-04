# Circle Back® — The Professional Phrase Organ

A satirical LinkedIn audio mixer: a 16-key phrase sampler that speaks corporate
clichés ("Humbled and honored to share", "Let's circle back", "Full stop.")
in time over a live-synthesized WebAudio drum machine. Form CB-16 · Rev. 2026-08 ·
For internal thought leadership only.

Built from the design handoff in `design_handoff_circle_back_mixer/` —
Swiss International Style played dead straight as corporate bureaucracy.

## Run it

```sh
npm install
npm run dev
```

Then open the printed local URL. `npm run build` produces a static bundle in `dist/`.

## How to play

- **Keys** `1234` `qwer` `asdf` `zxcv` (or click/tap) speak the 16 phrases and arm them.
- **Space** convenes/adjourns the meeting (play/stop).
- **Sequencer**: click drum cells to cycle off → hit (blue) → accent (ink); click Vox
  cells to stamp the armed phrase's two-letter code; drag paints.
- **Minute-take** records: while playing, pressed keys are stamped into the Vox row
  at the current step.
- **Registers**: drag dials vertically (Shift = fine, double-click = reset,
  wheel = ±3%). Sincerity and Delivery shape the spoken voice; Tempo is 60–200 BPM.
- **Load agenda** seeds a demo pattern; **Table it** clears the grid.

## Structure

```
src/
  main.jsx                 entry
  CircleBack.jsx           the mixer screen: state + lookahead scheduler
  audio.js                 CBAudio drum synth (pure WebAudio, no samples) + CBVoice speech
  lexicon.js               full LinkedIn phrase bank (openers / buzzwords / AI tells / closers)
  styles.css, tokens/      design tokens as CSS custom properties
  components/
    chassis/               Unit, Masthead, Ticker, Bay, Silk, Readout, Stamp
    controls/              Button, Knob, Kbd
    pads/                  Pad, KeyPlate
    sequencer/             StepGrid
design_handoff_circle_back_mixer/   original design handoff (reference)
```

Audio starts on first gesture (autoplay policy). Speech uses the browser's
`speechSynthesis` — the LinkedIn larynx.

Circle Back® is not affiliated with your network.
