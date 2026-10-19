# Character voice library

The humans need stable human casting. Synergy and Synthia retain distinct digital
identities. Voice profiles belong to characters, not grid positions. Silent cast
members (printer, paper droid, Pat) must never enter a vocal chorus.

## Current state

The catalog indexes 196 character lines from 14 authored meetings, including
chorus phrases for each participant and three audition reads per human. The
user approved all seven human identities on October 19, after the Linda,
Strategy, and Kevin revision. Those identities now map to the full season.

| Character | Preset | Speed | Delivery |
| --- | --- | --- | --- |
| People & Culture | af_heart | 0.97 | Warm, reassuring |
| Strategy | am_onyx | 0.95 | Low, deliberate |
| Kevin / Partnerships | am_puck | 1.06 | Lighter, conversational |
| Keys / Enablement | af_bella | 0.98 | Calm, friendly |
| Operations | am_michael | 0.97 | Unhurried, matter-of-fact |
| Arjun / Finance | bm_george | 1.00 | Precise, restrained |
| Linda / Governance | af_nicole | 0.91 | Low, husky, seasoned |

These are synthetic casting identities, not clones extracted from the footage.
Casting follows delivery, not an inferred accent based on appearance. Kokoro
uses the preset and speed; direction text is an editorial brief, not a model
acting instruction. Keep the approved acoustic version unless recasting is
explicitly requested. Previous candidates remain in the recording history.

The bank contains 119 current human takes (112 meeting lines plus seven common
audition reads), with lossless masters. The 21 audition takes have user listening
approval. Additional production takes have technical validation, **not a claim
of individual listening approval**. Their review metadata states that distinction.

## Files and commands

- `characters.js`: fixed approved voice, pace, identity version, direction.
- `library.js`: stable character/text IDs; exact acoustic cache keys; intact
  authored sequences and line usage metadata.
- `public/studio/voices/catalog.json`: portable line and meeting index.
- `public/studio/voices/recordings.json`: per-take duration, 25 Hz envelope,
  measured levels, hashes, approval state, and model/voice artifact identity.
- `assets/meeting-voices/masters/`: lossless FLAC originals in the repository.
- `public/studio/voices/audio/`: compressed takes for playback.
- `/studio/voices/`: seven casting auditions, with portraits and transcripts.

```sh
node scripts/build-meeting-voice-library.mjs
node scripts/render-meeting-voices.mjs --auditions
node scripts/check-meeting-voices.mjs
```

The renderer uses the project's existing local Kokoro installation, offline after
model caching. No Runway, ElevenLabs, or other paid generation API is called.
It verifies cached master and playback hashes before reuse. Changed text, voice,
speed, model weights, voice data, or processing settings produces a new take.
Render sequentially; a lock prevents two writers. Files and manifests are
committed atomically. Re-rendering does not grant listening approval.

## From casting to production

1. The user approves the audition identity. Set the profile to `approved` and
   record the approval date without changing its acoustic version.
2. Run `node scripts/render-meeting-voices.mjs --approved`. It fills missing
   human takes and preserves the exact preset, speed, and model artifacts.
3. Run `node scripts/validate-meeting-voice-bank.mjs`. Every current take must
   decode completely, match both hashes and the exact identity, have valid
   duration/envelopes, and pass silence/clipping checks. Auditions are marked
   user-approved; new lines are explicitly `validated`, not individually heard.
   The user's request to map the approved cast authorizes this production batch.
   A technical pass does not establish pronunciation or subjective quality.
4. Export with `node scripts/export-meeting-voice-bank.mjs /tmp/approved-meeting-voices.json`.
   Missing, stale, unvalidated takes or unapproved casts fail before export.
5. Export `library` from `scripts.js` to `/tmp/meeting-scripts.json`, then run
   `python scripts/render-meeting-season.py --voice-bank /tmp/approved-meeting-voices.json`.
   The bank is required: there is no silent fallback to human Flite placeholders.
6. Run both `npm run check:meeting-voices` and `npm run check:meeting`, decode the
   full timelines with `python scripts/check-meeting-audio.py`, and build. The voice check compares every human dialogue and
   chorus source against the current approved character and source master hash.

The timeline is rebuilt from measured durations; captions, turn borders,
robot mouth envelopes, and ducking follow it. Each cue records source takes.
Content-hashed timeline filenames prevent stale playback after deployment.

Natural speech is not singing. Short chorus phrases start together, then pad
with silence to the next beat. They are never pitch-shifted or resampled to fill
an arbitrary bar. Human video plates remain approximate turn-cued performances,
not phonetic lip sync. Featured close-ups need dedicated audio-driven lip sync.

## Expansion target: about 400 useful takes

Start with 40 per human (280): 4 greetings, 10 updates, 6 practical questions,
6 answers, 6 transitions, 4 short hooks, and 4 closing observations. Add about
60 per robot (120) for hosting and training. This is a production target, not a
claim that 400 recordings currently exist.

Write and approve connected exchanges first. Each reusable line records its
agenda, cue role, and original sequence. Keep setup → escalation → chorus →
button together. A response about access belongs after an access question.
Vary the roster, instrumental bed, intact exchange, and performance plate;
never assemble dialogue by randomly selecting isolated buzzwords.

For future exchanges add explicit entry/exit topic tags and compatible follow-up
IDs before enabling block-level randomization. Until then the runtime continues
choosing complete authored meetings. Content approval and voice approval are
separate: new scripts still require editorial review; the approved voice bank serves the
existing authored meetings.
