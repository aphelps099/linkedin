# LinkedIn Beats meeting studio

The canonical `/studio/` route is the full-width meeting room. The previous
four-person implementation and the Studio 2 engine remain in the repository;
the rest of the site still uses their existing shared audio components.

## Direction

Seven agendas, two authored variants per agenda. `New meeting` chooses a variant
other than the current one. Cast sizes are 3, 5, 9 or 12. We randomize complete
scripts, not disconnected sentences: the setup, escalation, chorus and closing
joke must remain in order. Synergy hosts every meeting.

`scripts.js` is the source of truth for the approved dialogue and cast.
`audio-manifest.json` contains the actual rendered cue offsets, durations and
25 Hz vocal envelopes. Voices and the instrumental bed start on the same Web
Audio clock. Captions, speaker outlines and the robot mouth read that timeline.
The speaking cast performs the shared chorus; printer, droid and Pat never sing.

The local recordings use the existing Studio 2 Flite family and its original
drums/bass/keyboard stems. Synergy and Synthia have stable, distinct voice
settings. They are deliberately dry computer speech, not expressive singing.
These recordings are not the newer LinkedInifier Kokoro announcer or exact
macOS Fred recordings. No voice service is called during playback. Swapping a
recording requires regenerating its cue durations/envelopes, not just an MP3.

## Character continuity and movement

Approved cast media is in `public/studio/season/`. Provenance and source takes are
recorded in `media-manifest.json`. The 20 motion files are silent 1280 × 720
plates. They load only after playback starts. Reduced motion uses still frames.
Hidden tabs pause the meeting. Failed video playback leaves the poster visible.

- Humans have speaking, listening, and (where applicable) instrument plates.
  These are turn-cued reusable performances, **not phonetic lip sync**. Keep
  original mouths attached to faces. Do not add floating mouth sprites.
- Musicians remain visibly at their instruments. Their performance states vary
  across the meeting. No reversed instrument footage.
- Synergy and Synthia use their approved idle footage. Eye positions were
  tracked to anchor the replacement mouth inside the black face screen.
  `robot-tracking.json` stores all 228 frames for each robot. It includes the
  small head and body movement; never anchor the overlay to the tile itself.
- The robot mouth is ONE fixed-height green horizontal row near the bottom of
  the screen. Light travels left to right. Vocal level affects brightness only.
  **Never animate vertical height, warp the metal, move the mouth into the
  middle of the head, or redesign either robot.** Eyes remain the source eyes.
- Printer media is a finite real print event followed by a held last frame.
  Seeking resets it to the corresponding moment. Do not loop a growing paper
  stack or reverse pages back into the printer. A longer continuous print
  action requires additional approved footage.
- The droid uses the approved still reference. Pat remains camera-off.

Human clip transitions are editorial cuts. The plates are not certified
seamless loops; use future matched neutral endpoints to improve idle repeats.

## Controls and playback

Agenda and New meeting reset to a paused meeting, retaining the user's mix.
Play is the only audio activation gesture. Sound mutes the entire meeting;
Mix independently changes voices/music with no source restart. Speaker view
follows the current speaker; clicking a tile manually spotlights that person.
Stop video, captions, reactions, leave/rejoin, seek and replay are local controls.
No webcam, microphone or third-party meeting service is accessed.

The playback engine cancels stale loads, caches at most four decoded buffers,
handles browser audio interruptions, ducks music under dialogue and limits
output peaks. It does not call any paid generation API.

## Rebuilding and checking

Run `npm run check:meeting` and `npm run build`.

To regenerate the local audio, export `library` from `scripts.js` as JSON to
`/tmp/meeting-scripts.json`, then run `python scripts/render-meeting-season.py`.
Requirements: ffmpeg with Flite, NumPy and SciPy. For new robot plates run
`python scripts/track-meeting-robots.py` (also needs OpenCV), then inspect every
face overlay against the actual footage before shipping. Never reuse tracking
coordinates for a different video.
