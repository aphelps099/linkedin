# Training 02: Caffeinated Edition

50-second recut of **How to Answer Without Answering**. Synergy's approved ivory/chrome body and headset stay consistent. New performance plates give him fast typing, lively hands and a small celebratory flourish. Multiple coffee cups establish the overcaffeinated desk.

The unchanged comic structure is a simple question, an honest “Friday,” an inflated ChatGPT answer, a repeated question, and a working group instead of an answer. A new jazzy hip-hop instrumental stays prominent between lines and ducks under speech. The voice uses the existing dry Synergy eSpeak NG profile; no ElevenLabs.

## Rebuild

Run from the workspace containing `linkedin-hero/`, `training-02-recut/` and the recovered `brand-story/` sources:

```sh
python3 linkedin-hero/scripts/training_02/build_audio.py
python3 linkedin-hero/scripts/training_02/render.py --stills
python3 linkedin-hero/scripts/training_02/render.py
```

Requires Python, NumPy, SciPy, OpenCV, Pillow, ffmpeg/ffprobe and the repo's existing `retro_speech` setup. The input filenames are in `render.py`. Reusable raw performances are cataloged in the Cutting Room and Runway task IDs are in `assets/film-corrections/training-02/edit-proof.json`. Keep media masters out of git. Source quad/crop coordinates and audio cues are preserved alongside that proof.

## Character notes

- Preserve the full approved head silhouette, ivory/chrome finish and headset. No spontaneous body or face redesign.
- Only composite inside the black glass. The metal never deforms with speech.
- The mouth is one fixed-height horizontal LED row near the bottom of the glass. Brightness travels left to right; it never expands vertically.
- Eyes retain the source design and blink briefly. Avoid random dark eyes or unrelated green side lights.
- Speaking and listening both need small natural movement. Expressiveness comes from the head, shoulders, arms and fingers, not a changing face geometry.
- Wide shots retain the coffee cups. Screen inserts keep hands in front of the screen, never covered by a UI overlay.

Delivery: 1280×720, 24 fps, H.264/AAC stereo, 50 seconds. The final decodes without errors; audio is approximately −18.6 LUFS with a −1.3 dBFS true peak. Tracking QA found no fallback frames and median landmark errors below 0.3 pixels for both new plates. Final editorial review still matters; these measurements do not promise flawless generated motion.
