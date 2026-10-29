# Photo performance and series packaging — version 4

October 29, 2026. Aaron liked version 3 and requested fast meeting-loading details, additional real human expressions/instrument views, occasional corporate backdrops, rapid paper-collage branding, end credits and clearer, younger Synergy voice options. This is a local review, not a live-site release.

## Review

- Review page: http://127.0.0.1:8852/paper-meeting-chatgpt/photo-plus/
- Master: `/Users/ap457/Projects/linkedinbeats-meeting-art/optimizing/paper-meeting-chatgpt/photo-plus/output/chatgpt-meeting-photo-v4.mp4`
- 90 seconds, 1280 × 720, 24 fps. Original AAC dialogue/music track copied unchanged from version 1; byte identity verified.
- The page includes voice auditions, seven human performance cards and six unique coffee takes. Listening/speaking/instrument buttons switch existing footage. Speaking studies are not lip-synced to this episode's new words.

## Visual changes

- 0–2.5 s: locally composited blue paper, graph sheet, quick individual letter arrivals, existing logo and TT Hoves episode title. Layers settle quickly so the title remains readable. No AI-generated logo or substituted typeface.
- 2.5–3.04 s: staggered, brief connecting states in the meeting grid. Dialogue begins at 3.10 s.
- 7.55–8.205 and 35.31–36.11 s: actual People & Culture listening/blinking footage.
- 23.91–24.81 s: a wider Operations/drum-pad insert, framed to retain hands and instrument.
- 39.27–41.07 s: supplied Synergy coffee footage during an existing pause. The selected clip is take 0 in the source manifest. Crop excludes its baked corner interface marks. No new speech mouth is drawn over this silent sip.
- 84.34–85 s: actual Operations listening reaction after the final line.
- 85–90 s: readable graph-paper credits: site, LinkedIn non-affiliation, Aaron Phelps / Look-Serious.com.

All new performance inserts are extracted at 12 fps and held for two frames in the 24 fps edit. This matches the deliberately limited photographic animation. Existing speaking portraits, expressive digital face, printer feed, close-ups and caption timing remain from version 3. The lower-jaw animation remains amplitude-driven, not phonetic lip sync.

## Performance library

Reused original listening and speaking clips for People & Culture, Operations, Kevin, Keys, Strategy, Arjun and Linda. Wider instrument coverage is included for Operations (drum pad), Kevin (guitar) and Keys (keyboard). Do not invent instrumental duties for the other characters. Strategy's existing city-skyline background demonstrates the corporate virtual-background direction in the library; it is not inserted as a new participant in this episode.

Seven uploaded coffee files contain six unique videos. The two `e4c0e0d0..._0` files are byte-identical. Originals remain in Downloads; unique copies are archived under the review's `assets/` directory. `coffee-sources.json` records exact source paths, SHA-256 and durations. The other coffee takes are available for future edits; only the inspected short take-0 segment is used here.

## Voice auditions, not a recast

Identical comparison text: “Today, I used ChatGPT to optimize our onboarding checklist. A more intentional first day. About staying human in the age of AI.”

- A: Runway Brodie preset, youthful delivery; local amplitude modulation retains a 94% dry carrier with a 6% 72 Hz component. No added delay/reverb. This is the lighter electronic option.
- B: Runway Xylar preset, inherently modulated character. No additional delay/reverb.
- Current: existing dry eSpeak takes 0, 3 and 25, separated by short silences.

All comparison samples target −18 LUFS and −2 dBTP. The two new generations cost three credits each. Source MP3s are retained in `voice-audition-sources/`; exact task IDs and treatment are in `voice-auditions.json`. The episode still uses its established voice. Listening judgment and character selection remain with Aaron; technical normalization is not a claim of subjective preference.

## Reproduce

Use the existing project Python environment (numpy, scipy, imageio-ffmpeg), local Chrome and Playwright. Version 1 audio and version 3 envelope/timing outputs must already exist. The original uploaded coffee source paths are recorded in the manifest.

```sh
python docs/project/episodes/chatgpt-onboarding/prepare-photo-plus.py /path/to/paper-meeting-chatgpt/photo-plus
python docs/project/episodes/chatgpt-onboarding/process-voice-auditions.py /path/to/paper-meeting-chatgpt/photo-plus
node docs/project/episodes/chatgpt-onboarding/render-photo-plus-video.mjs /path/to/paper-meeting-chatgpt/photo-plus
python docs/project/episodes/chatgpt-onboarding/build-photo-plus-review.py /path/to/paper-meeting-chatgpt/photo-plus
```

See `verification-photo-v4.json`: full decode succeeds, original audio hash matches, all 17 review-page media elements load, playback/seek and instrument switching work, no page errors or horizontal mobile overflow. Review frames include opening, connecting states, new inserts, printer, face and closing credits. Large media masters and extracted frames remain outside Git.
