# Five quick meetings · Episodes 05–09

Requested October 29, 2026: five new 30–40 second videos with more Strategy and Linda, plus recurring Corporate visits bringing banners and AI playbooks. These are landscape meeting films, not automatically converted vertical YouTube Shorts.

Review hub: http://127.0.0.1:8852/shorts/.

| Episode | Title | Scene |
| --- | --- | --- |
| 05 | A new direction. | Corporate brings a new banner. Linda asks that the exit remain usable. |
| 06 | Thoroughly reviewed. | AI has reviewed its own playbook. Linda will read page two. |
| 07 | One source of truth. | Strategy proposes ownership. Linda grants the actual access request. |
| 08 | The legacy process. | A renamed spreadsheet becomes an intelligence platform. The formulas stay put. |
| 09 | Ready to roll out. | A playbook calls for the alignment meeting the team is already attending. |

Each episode has a script, brief and timed dialogue in its repository folder. Canonical voice takes, motion caches, mix stems, finished video, frames and captions are under `../optimizing/shorts/`. First review cuts; no public uploads or release dates assigned.

## Picture and voices

Strategy uses approved Kokoro `am_onyx` at .95; Linda uses `af_nicole` at .91. Their actual five-second listening performances supply small head movements and blinks, sampled at 12 fps. Optical-flow transforms track a small, amplitude-driven jaw treatment. This is limited animation, not phonetic lip sync. Use measured close-ups for selected responses and a final silent Linda reaction; no zigzag camera.

Synthia visits as Corporate Enablement, retaining the existing Flite `slt` voice and 1.04 pitch treatment. The local Flite 2.3 source build is from https://github.com/festvox/flite (outside the repo at `../optimizing/tools/flite`). Spelling normalization makes **AI → A I** for synthesis only; captions retain AI. No ElevenLabs. Synergy retains his eSpeak identity, fixed single-row left-to-right EQ and 10% resting track.

The Corporate arrival is the original banner crew's blank plate from the cutting-room catalog. Native wordmark and banner text are composited onto the tracked center banner. The AI playbooks and reporting screens are native TT Hoves/paper layouts, not generated text baked into a photo. Keep their copy sparse. The printer remains centered 4:3 with equal black sides and forward-feeding paper.

Original 96 BPM music, ducked under speech; no new score or generation API. Intro 2.5 seconds, Corporate arrival 2 seconds where present, brief practical-resolution prop, then 3-second hashtag outro.

## Rebuild

Use the existing local dependencies and preview server. From the repository root:

```sh
../optimizing/.venv/bin/python docs/project/episodes/production/prepare-short-assets.py
```

This verifies catalog hashes, extracts the clean Synthia plate and actual human/crew footage, and prepares mouth-position and banner tracking. It downloads the two existing project assets only if missing. Requires the local Flite `bin/flite` executable for Synthia. To build it from the upstream source in the tools folder: `./configure --with-audio=none` followed by `make -j4`.

For each of `new-direction`, `ai-reviewed`, `one-source`, `legacy-process`, `rollout-ready`:

```sh
node docs/project/episodes/chatgpt-onboarding/render-voices.mjs ../optimizing/shorts/<slug>/source docs/project/episodes/<slug>/script.json
../optimizing/.venv/bin/python docs/project/episodes/production/build-episode-audio.py docs/project/episodes/<slug>/script.json ../optimizing/shorts/<slug>
node docs/project/episodes/production/render-episode.mjs ../optimizing/shorts/<slug>
```

Then `python3 docs/project/episodes/production/build-short-reviews.py` creates the hub, individual players, bulk MP4/caption/script ZIP and navigation from the existing studio/channel kit. Narration is not sped up to force a duration: the audio builder rejects scripts that exceed 40 seconds.

## Cost scope

Zero new Runway generations for these five cuts. Reused catalog footage, local voices, original score and local compositing. This is a statement about this production batch, not an account-wide credit balance.

## Thoroughly reviewed · revision 2

All camera pictures now use a common 4:3 aperture **above** the name strip. Human source plates have their baked-in sidebars/labels removed before framing. Synthia and the printer use the same aperture dimensions; the participant tile and active-speaker outline retain the site layout.

Linda coughs after “comprehensive,” using a new filmed reaction and its synchronized native cough audio. Strategy's final line becomes the abrupt “HUMAN OVERSIGHT!” with a corresponding facial performance, his established Kokoro voice, a 3.4 dB dialogue-stem increase and a brief music dip. The first cut is archived locally. Only episode 06 is re-rendered for this revision; future renders inherit the common camera geometry. Revision media generation is separate from the original batch's zero-generation cost scope.
