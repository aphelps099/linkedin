# LinkedIn Beats meeting studio

The canonical `/studio/` route is the full-width meeting room. The previous
four-person implementation and the Studio 2 engine remain in the repository;
the rest of the site still uses their existing shared audio components.

## Direction

Seven agendas, two authored variants per agenda. `Next meeting` advances through
all seven agendas, then their seven alternate takes, then wraps. No shuffling or
repeats until all 14 meetings have played. The collapsed agenda contains a description and direct access to both takes of every playlist.
Cast sizes are 3, 5, 9 or 12. The setup, escalation, chorus and closing joke remain
in their authored order. Synergy hosts every meeting.

`scripts.js` is the source of truth for the approved dialogue and cast.
`audio-manifest.json` contains the actual rendered cue offsets, durations and
25 Hz vocal envelopes. Voices and the instrumental bed start on the same Web
Audio clock. Captions, speaker outlines and the robot mouth read that timeline.
The speaking cast performs the shared chorus; printer, droid and Pat never sing.

The human voices are the user-approved Kokoro cast from October 19. Linda uses
Nicole, Strategy uses Onyx, and Kevin uses Puck; identities are fixed per
character in `voice-bank/characters.js`. Synergy uses eSpeak NG formant speech,
with a narrow pitch range and the LinkedInifier's portable robot rate/pitch.
This is an old Mac-style approximation, not Apple's original Fred voice. Synthia
keeps her distinct Flite voice. The instrumental beds remain the Studio 2 stems.
No voice service is called during playback.

All 14 timelines are rebuilt from the actual recordings. Each cue records its
source take IDs and master hashes; the seven human cast profiles are embedded
in the manifest. Full voice timelines use content-hashed filenames so a returning
listener cannot get old audio with new caption timing. Choruses start together
and pad to beats, without pitch-changing resampling.

See `voice-bank/README.md` for the reusable line bank and validation workflow.
The cast samples remain available at `/studio/voices/`.

## Character continuity and movement

Approved cast media is in `public/studio/season/`. Provenance and source takes are
recorded in `media-manifest.json` and `PERFORMANCE-PRODUCTION.md`. The motion
plates load only after playback starts. Reduced motion uses still frames.
Hidden tabs pause the meeting. Failed video playback leaves the poster visible.

- Humans have speaking, listening, and (where applicable) instrument plates.
  Stand-up 1, Onboarding 1, Unlocking potential 1 and Offline 1 have exact
  audio-driven performances for every human solo and chorus. Other meetings
  retain approximate turn-cued plates, **not phonetic lip sync**. Keep original
  mouths attached to faces. Do not add floating mouth sprites.
- Musicians remain visibly at their instruments. Their performance states vary
  across the meeting. No reversed instrument footage.
- Synergy and Synthia use their approved idle footage. Eye positions were
  tracked to anchor the replacement mouth inside the black face screen.
  `robot-tracking.json` stores 408 Synergy and 454 Synthia frames. It includes the
  small head and body movement; never anchor the overlay to the tile itself.
- The robot mouth is ONE fixed-height green horizontal row near the bottom of
  the screen. Synergy uses the shared `synergy-display.js` painter: 1×10 logical
  pixels, half the open-eye height (2×2). The left edge is fixed; speech fills rightward up to
  all ten cells; adjacent cells form a solid green line. A full-width 10% green
  track remains visible at rest and underneath speech. Synthia retains her
  existing brightness treatment. Run `node scripts/check-synergy-display.mjs`.
  **Never animate vertical height, warp the metal, move the mouth into the
  middle of the head, or redesign either robot.** Eyes remain the source eyes.
- Printer uses the approved clip's last stable frame plus its real printed page
  artwork. A canvas mesh feeds a sheet every 3.6 seconds and lands it on a growing
  stack. The printer body stays fixed; sheets never reverse or vanish on repeat.
  Meeting time determines the feed and page count, including after seek/replay.
  Pause, camera-off and reduced motion stop the animation. No new generation.
- The droid uses the approved still reference. Pat remains camera-off.

Human clip transitions are editorial cuts. The plates are not certified
seamless loops; use future matched neutral endpoints to improve idle repeats.

## Controls and playback

Agenda and Next meeting reset to a paused meeting, retaining the user's mix.
Play is the only audio activation gesture. Sound mutes the entire meeting;
Mix independently changes voices/music with no source restart. Speaker view
follows the current speaker; clicking a tile manually spotlights that person.
Stop video, captions, reactions, leave/rejoin, seek and replay are local controls.
No webcam, microphone or third-party meeting service is accessed.
The shared compact black navigation and complete dark site footer frame the room.
The meeting title sits in the window bar. There is no racing strip or large title
block. Next meeting sits beside Leave. The agenda starts collapsed, with seven
playlist descriptions and both takes available when expanded. Desktop galleries
scale to the viewport height to bring playback controls into view sooner.

The playback engine cancels stale loads, caches at most four decoded buffers,
handles browser audio interruptions, ducks music under dialogue and limits
output peaks. It does not call any paid generation API.
The first Founder meeting has a one-bar guitar interruption with three phrase
variations. Its choice remains stable through pause and seek; it shares the
music bus and loads only when that meeting is played. Founder camera tiles
use equal 3:2 frames with baked video margins cropped away.
Offline uses nine equal 4:3 cameras and compact silent speech clips. The keyboard
detail stays visible below Keys' face during her exact speaking and chorus turns.

## Rebuilding and checking

Run `npm run check:meeting` and `npm run build`.

To regenerate the local audio, export `library` from `scripts.js` as JSON to
`/tmp/meeting-scripts.json`, then export the approved voice bank and run
`python scripts/render-meeting-season.py --voice-bank /tmp/approved-meeting-voices.json`.
Requirements: ffmpeg with Flite, NumPy, SciPy, and eSpeak NG (system library or
`espeakng-loader==0.2.4`, currently bundles engine 1.52.0). For new robot plates run
`python scripts/track-meeting-robots.py` (also needs OpenCV), then inspect every
face overlay against the actual footage before shipping. Never reuse tracking
coordinates for a different video.

The agenda now opens as a thumbnail library with one card per meeting and playlist filters. Cards play the selected meeting immediately. Invite someone in the player or on a card opens a review dialog with editable invitation, copy, email/native sharing, and the existing opt-in LinkedIn publisher. Every invitation targets `/studio/?meeting=<id>` and gets server-rendered meeting-specific Open Graph metadata and a 1200×630 cast image. Opening a received link selects the meeting without autoplay; no login is required to watch. These are recorded-meeting invitations, not calendar events or live calls. No invitations are sent automatically.

Mobile audio uses the shared `src/audio-session.js` session: native inline playback and Web Audio are primed synchronously during Play or a thumbnail tap, before downloads. Pause/end/disposal release the native session. A suspended context after decoding produces a visible retry instead of a silently advancing timeline; retry reuses decoded voice/music buffers. Downloads have a 25-second deadline. The homepage music engine and Synth share the same session helper.

`node scripts/check-meeting-mobile.mjs` verifies gesture ordering, voice/music synchronization, interrupted playback, cached retry, audio focus, cancellation, deadlines and cleanup. Real iOS speaker output still requires a physical-device check.
