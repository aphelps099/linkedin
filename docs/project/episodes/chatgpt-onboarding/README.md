# A more intentional first day

First office-paper meeting scene, October 29, 2026. **90 seconds, 1280 × 720, 24 fps. First review cut; not published or creatively approved.**

Synergy used ChatGPT to improve the onboarding checklist. People & Culture checks its claims against the new starter's actual first day; Operations fixes access and plans to ask what was missing. A useful improvement becomes the subject of Synergy's professional reflection.

## Alternate cel edit

The [second cut](cel-version.md) explores the requested Flying House-style drawing, stronger Ken Burns camera moves, watercolor/marker transitions and deadpan close-ups. Its original audio is retained. Both versions remain available for comparison.

## Watch

- Local preview: http://127.0.0.1:8852/paper-meeting-chatgpt/
- Master: `/Users/ap457/Projects/linkedinbeats-meeting-art/optimizing/paper-meeting-chatgpt/output/chatgpt-meeting-v1.mp4`
- Separate dialogue, music, paper effects and caption track are in the same output directory.

This uses the existing paper meeting illustration, cropped and composed as separate rounded cards. The motion is a short card entrance, cuts between speakers, restrained camera movement and phrase cards. Characters do not have lip sync or new hand/coffee animation. The printer motor is a sound cue; its sheet remains still. This is the economical storybook format's first concrete test.

## Continuity

Human voices use the approved meeting cast: People & Culture = Kokoro `af_heart` at 0.97; Operations = `am_michael` at 0.97. Same cached q8 model and voice presets as the current meeting renderer. Synergy uses eSpeak NG 1.52.0, `en-us`, rate 154, pitch 35, range 4, with the established dry bandpass. No recasting, voice cloning, vocoder or reverb. New takes still need listening review. Profiles and model hash are recorded in `voice-provenance.json`.

Music is an interior 16-bar loop of the existing original paper-droid score conformed to 96 BPM, with speech ducking and new fades. It is not a newly generated imitation. Source hash is recorded in `timeline.json`. Short original paper-shuffle and printer-motor effects are synthesized locally. No Runway generation credits were spent on this scene.

Artwork: `docs/project/art/paper-meeting-grid-v1.png`. Brand: existing outlined black/white wordmark SVGs. Typography: existing TT Hoves regular and demibold. Frames are compositor masks with a uniform 12-pixel inset. Text passage cuts follow measured pauses; normal captions follow complete spoken turns.

## Reproduce

From the repository root, with the existing project Node dependencies and the film Python environment:

```sh
node docs/project/episodes/chatgpt-onboarding/render-voices.mjs /Users/ap457/Projects/linkedinbeats-meeting-art/optimizing/paper-meeting-chatgpt/source
/Users/ap457/Projects/linkedinbeats-meeting-art/optimizing/.venv/bin/python docs/project/episodes/chatgpt-onboarding/build-audio.py /Users/ap457/Projects/linkedinbeats-meeting-art/optimizing/paper-meeting-chatgpt
node docs/project/episodes/chatgpt-onboarding/render-video.mjs /Users/ap457/Projects/linkedinbeats-meeting-art/optimizing/paper-meeting-chatgpt
```

The voice renderer uses cached models only. Python dependencies: numpy, scipy, imageio-ffmpeg and espeakng-loader 0.2.4. The frame renderer uses local Chrome and playwright-core. Existing score and art paths are intentionally reused; media masters remain outside Git. The established port 8852 review server serves the film workspace.

## Verification

Full export decode passed. Duration 90 seconds. No overlapping dialogue cues. Decoded mix measured −16.33 LUFS integrated and −1.05 dB true peak. Browser playback and seeking to 60 seconds succeeded with a 1280 × 720 video and no page errors. Reviewed representative intro, grid, close-up and phrase-card frames. These are technical and visual checks, not a claim of user approval or subjective listening review. See `verification.json`.
