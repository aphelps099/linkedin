# Welcome to the Office

A 60-second LinkedIn Beats brand opening, 1280 × 720, 24 fps, stereo audio.

The office is being prepared for compulsory authenticity. Two completely
serious installers arrive with retractable banners. They level the signage,
then later measure the gap between two identical authenticity slogans.
The established cast is introduced as an office band in warm ivory and blue
television-style credits. Each instrument joins the beat as its player appears.
Linda's offscreen reply to the installation is: “We did this last year.”
The printer and towing droid complete the cast. Synergy and Synthia deliver the
call and response: “Humbled.” “Honored.” “Excited to share.” The last wide shot
reveals the fully branded office, with the band still playing.

## Continuity rules

- Preserve the approved Synergy and Synthia camera-v2 plates. Their identities,
  body scale, ivory/chrome surfaces, headsets and clothing are established.
- The mouth is one thin horizontal row of 22 green LEDs. Its height is fixed.
  Only brightness travels left to right. Never create vertical audio bars or
  animate the surrounding metal. Speech is driven by the corresponding voice.
- Occasional brief eye blinks remain inside the original square eye regions.
- Retain small natural human movements. Do not substitute frozen photographs.
- Instrument introductions must retain hands, drum pads and keyboard keys.
- The printer outputs solid sheets onto a supported pile. Existing pages do
  not shimmer or change size. The cart droid uses the approved departure shot.
- Typography on physical banners is composited onto tracked blue surfaces,
  with occlusion masking. Do not ask the video model to regenerate lettering.
- Avoid fake camera shake, film jitter, flicker or VHS artifacts.

## New footage and budget

Hard authorization: at most **10,000 additional Runway credits**.
Actual spend: **680 credits**. Verified account balance afterward: **19,541**.
No further generations are queued. Full prompts and charges: `credits.json`.

| Shot | Task | Cost |
| --- | --- | ---: |
| Installers arrive | `e0a61b2f-c794-4301-89f7-93ed8acb8039` | 170 |
| Banner installation | `4d403fcb-279d-4bb4-9906-fb94091e0272` | 170 |
| Measuring banner spacing | `b25b751c-225d-4800-9ca3-085cb0bda8ab` | 170 |
| Full office band | `e7c6c02e-3e82-48a9-91b2-5994f040065b` | 170 |

All four are silent Kling O3 Pro ten-second source clips. Only the first
2.2 seconds of the measuring shot are used; a later generated reverse angle
is deliberately excluded. The final master is 720p, regardless of the source
provider's larger output size. Source references remain attached to each task.

## Sound

The original 88 BPM Humbled & Honored stems supply the drums, bass and keys.
The approved original founder guitar fills add brief accents. Speech ducks the
music. Synergy uses the approved espeak-ng desktop voice. Synthia uses flite
SLT at her established 1.04 pitch. Linda uses her approved af_nicole casting
at 0.91 speed. No ElevenLabs or paid music generation is used.

The exact isolated speech takes are retained in `voices/`. The stereo master
targets −18 LUFS with a −1.5 dBTP ceiling. The final MP4 includes AAC audio.

## Rebuilding

`scripts/render-office-brand-film.py WORKSPACE` writes the complete film,
contact sheet and edit proof. Add `--stills` to inspect composited review frames.
The script expects the four downloaded source clips under
`WORKSPACE/brand-story/raw/` named `arrival.mp4`, `banner.mp4`, `measure.mp4`,
and `ensemble.mp4`. Copy the retained voice WAVs to `brand-story/audio/`.
Approved cast plates and original music come from existing repository assets.
The approved droid departure and music stem manifest are referenced from the
existing watercooler production workspace. `edit-proof.json` records exact
cuts, speech times and the final file hash after rendering.

The finished video is delivered separately. This production does not replace
the current homepage hero or add large raw videos to the website bundle.
