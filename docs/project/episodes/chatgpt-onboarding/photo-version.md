# Original-photo performance — version 3

Requested October 29, 2026 after the paper and cel cuts felt insufficiently convincing. Direction: use actual cast images, a humorous mouth-animation treatment, awkward extreme close-ups and greater dramatic tension. Synergy should be the most expressive character, with visible digital mouth/face movement. Show the printer printing LinkedIn-logo pages.

## This cut

90-second alternate review cut using the original People & Culture, Operations, Synergy and printer photographs from `public/studio/season/posters/`. The same script and original version-1 audio are retained. No new voice, music, image or Runway video generation.

Humans use intentionally limited photo-puppet animation: a small attached lower-lip/jaw region moves in stepped positions, driven by their own recorded speech envelope. The maximum source-image displacement is seven pixels for People & Culture and six for Operations. The original photographed lower lip and chin are retained; no disconnected mouth sprite or cartoon replacement mouth is used. A small softened interior shadow opens with the jaw. Faces stop moving outside speaking turns. This is stylized amplitude-driven animation, **not phonetic or naturalistic lip sync**.

Synergy has a digital face replacement anchored inside his actual photographed screen. Green pixel mouth width, illumination and up to three short rows respond to speech. Eyes blink and shift subtly during selected listening pauses. The armor, headset, coffee cup and physical head remain the source image. This explores the user's new request for a more expressive screen; it does not change the existing live meeting engine's approved fixed-height mouth or replace its camera plate.

The printer reuses the established `src/meeting-room/printer-paper.js` compositor over `printer-neutral.jpg`, including the actual LinkedIn page artwork. Feed and accumulated stack follow continuous scene time through camera cuts. Paper moves outward, and the stack persists. Close-ups frame the output slot and logo clearly. This is controlled photo compositing, not newly generated printer footage.

The edit retains hard cuts, slow camera moves, held reactions and extreme eye/screen close-ups. The previous full-screen corporate-language cards now show Synergy delivering the words. The branded intro remains 2.5 seconds. Human artwork is no longer rendered as paper or cel characters in this version. Original source softness remains visible at extreme magnification.

## Preview and reproduction

- Preview: http://127.0.0.1:8852/paper-meeting-chatgpt/photo/
- Master: `/Users/ap457/Projects/linkedinbeats-meeting-art/optimizing/paper-meeting-chatgpt/photo/output/chatgpt-meeting-photo-v3.mp4`
- Frame renderer and editable performance controls: `scene-photo.html`.
- Audio-envelope preparation: `prepare-photo.py`.
- Video export: `render-photo-video.mjs`.

```sh
/Users/ap457/Projects/linkedinbeats-meeting-art/optimizing/.venv/bin/python docs/project/episodes/chatgpt-onboarding/prepare-photo.py /Users/ap457/Projects/linkedinbeats-meeting-art/optimizing/paper-meeting-chatgpt
node docs/project/episodes/chatgpt-onboarding/render-photo-video.mjs /Users/ap457/Projects/linkedinbeats-meeting-art/optimizing/paper-meeting-chatgpt/photo
```

Version 1 supplies its exact AAC track, copied without audio re-encoding. Both older visual cuts remain available. This is a local review cut and has not been released on the live site. See `verification-photo-v3.json` for technical checks; creative acceptance remains pending.
