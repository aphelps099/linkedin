# Meeting production · Episodes 02–04

Three first production cuts rendered October 29, 2026. Each is 90 seconds, 1080p, 24 fps with AAC audio and separate WebVTT captions. Local review room: http://127.0.0.1:8852/series/.

1. **Great connecting.** Conference follow-up becomes a useful introduction rather than a generic relationship update.
2. **A meaningful increase.** Ninety-three impressions lead to one person asking for the intern's checklist.
3. **Continuing development.** The meeting about protecting learning time consumes the learning time; Synergy cancels the check-in.

Each episode folder in the repository holds its brief, 22-line script and generated timeline. Finished media, source voice takes and review frames live in `../optimizing/series/<slug>/`. These are first review cuts; creative listening, pacing and performance review remain open. No release dates assigned.

## Rebuild one episode

Run from the repository root, replacing `<slug>` with `great-connecting`, `meaningful-increase` or `continuing-development`:

```sh
node docs/project/episodes/chatgpt-onboarding/render-voices.mjs ../optimizing/series/<slug>/source docs/project/episodes/<slug>/script.json
../optimizing/.venv/bin/python docs/project/episodes/production/build-episode-audio.py docs/project/episodes/<slug>/script.json ../optimizing/series/<slug>
node docs/project/episodes/production/render-episode.mjs ../optimizing/series/<slug>
python3 docs/project/episodes/production/build-reviews.py
python3 docs/project/episodes/chatgpt-onboarding/build-studio-review.py ../optimizing/paper-meeting-chatgpt/studio
```

Prerequisites: cached local Kokoro model, eSpeak NG, local Python audio environment, Playwright/Chrome, approved pilot HD plates and instrument-frame cache. `--stills` on render-episode previews key frames without encoding a movie.

## Continuity

- Existing cast voice settings from `voice-bank/characters.js`; canonical local eSpeak Synergy. No ElevenLabs.
- Reuses original 96 BPM score; voice ducking, -16 LUFS loudness target, no new echo.
- Uses original photographic cast. Human mouths are restrained amplitude-driven jaw composites, not phonetic lip sync. Kevin and Arjun have their own source-coordinate mouth maps.
- Shared Synergy display helper: fixed left-to-right, one-row mouth, ten logical cells, permanent 10% idle track.
- Shared printer-paper helper, normal forward-feed paper; the printer composite is centered 4:3 with equal black side borders.
- Same 2.5-second real-instrument paper collage intro, calm branded meeting layout and hashtag outro.
- Endings are fictional local scene graphics: an email, a draft post and a lesson. They do not send messages or interact with external accounts.

## Costs and review

No Runway requests for these three cuts. Voices, compositing and rendering are local; existing footage and score are reused. The separate channel-avatar work used built-in imagegen, not Runway. This record is not an account-wide credit audit.

Checked: frame rendering, page scripts, MP4 browser metadata/playback/seeking, 1001 Synergy display levels, and representative intro/meeting/ending frames. Final expressive performance and dialogue listening still need creative review.

Measured mix loudness: Great connecting −16.96 LUFS; A meaningful increase −16.48 LUFS; Continuing development −16.80 LUFS. All three true peaks measured −1.49 dBTP. Detailed values are in `audio-validation.json`; these measurements do not substitute for a creative listening review.
