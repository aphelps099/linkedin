# Meeting studio

The canonical `/studio/` is the approved cobalt four-participant music-video room with black navigation, a thin racing banner, and a compact six-track transport. `/studio-2/` retains the giant ASCII performance stage.

The room uses the existing Studio 02 score, rendered audio packs, Web Audio scheduler, and playlist. It never asks for a camera or microphone and opens no real conference connection. Playback starts only through a user gesture. Clicking an idle participant starts the meeting; after playback begins, clicking a participant spotlights it. The same keyed video elements stay mounted during layout changes. Grid view and Escape clear the spotlight. The Mix panel includes opt-in automatic spotlight direction, beat energy, confidence, voice mode, vocabulary pairs and chorus recall.

Mic buttons change actual audio gain: Strategic Partnerships = drums; People & Culture = keys plus the lift layer; Workflow Automation = robot vocals; Thought Leader = bass. Muting uses a short gain ramp while the sources keep running, so unmuting is phase-aligned. Mutes survive pause, seeking and song changes. Reset mix restores all four parts. Vocal captions use the measured scheduled voice cues; they disappear when vocals are muted. Camera-off “Connecting to audio…” is the fictional participant's running joke, not actual network status.

The main layout follows the approved sketch. New webcam footage could not be generated because the connected Runway workspace had 2 credits remaining at implementation time. This release therefore reuses real motion from the previously approved office-band clips, with the drummer, keyboard player and original same-size copier droid. These are editorial office camera views, not newly generated front-facing webcam takes. Muted, trimmed, crossfaded local MP4 loops and first-frame WebP posters live in `public/studio/meeting/`. No audio is embedded in the videos. Replace the matching `drums`, `keys`, and `vocals` files to upgrade to the exact webcam views later; the meeting layout and audio behavior need no change.

Media source edit notes (24 fps, 960×540 H.264, CRF 24, faststart):

| Asset | Existing source | Start / source length | Crop |
| --- | --- | --- | --- |
| drums | drummer-reveal.mp4 | 8.05s / 1.95s | 1440×810 at 320,0 |
| keys | office-reveal.mp4 | 6.2s / 2.25s | 1440×810 at 0,230 |
| vocals | copier-robot.mp4 | 8s / 2s | 1136×639 at 0,390 |

Each source is split after scaling: the first 0.25s is crossfaded over the final 0.25s, with the loop beginning at source time 0.25s. Asset requests wait for playback. Posters show before play, when videos fail, or when motion is reduced. Video motion pauses with the song, when its part is muted, when the tab is hidden, or when offscreen. The Motion control freezes visuals independently of audio. System reduced motion freezes all animated imagery. ASCII uses the actual master analyser and caps drawing at roughly 15 fps.

Verification: `node scripts/check-studio2.mjs`, `node scripts/check-meeting.mjs`, and `npm run build`. The meeting check exercises participant gain routing, persistent mute state, silence/reset, director decisions, and server-rendered controls/assets. Media decoded successfully with ffmpeg and posters were visually inspected. Browser control was unavailable, so real-browser visual and audible QA remains outstanding.
