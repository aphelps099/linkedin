# Character voice library

The humans need stable human casting. Synergy and Synthia retain distinct digital
identities. Voice profiles belong to characters, not grid positions. Silent cast
members (printer, paper droid, Pat) must never enter a vocal chorus.

## Current state

The catalog indexes the 14 authored meetings, including chorus phrases for each
participating character. It also includes three audition reads per human. Only
the 21 audition reads have been rendered with the new human voices. This is a
casting pilot, not an approved replacement for the live Studio's audio.

The seven Kokoro presets are **casting candidates**, not replicas extracted from
earlier videos. Casting choices follow performance and intelligibility; do not
infer an accent from a character's appearance. Direction text is an editorial
brief for listening review; Kokoro does not accept it as an acting instruction.
Speed and preset are the actual controls. If a candidate does not fit the face,
change the casting before generating hundreds of lines.

## Files and commands

- `characters.js`: fixed candidate voice, pace, identity version, direction.
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

1. Listen with the portrait. Review the common read, a longer update, and a short
   reaction. Approve the character identity only after the user chooses it.
2. Set the selected profile's `status` to `approved`. Preserve its version and
   preset. A changed voice is a new identity version, never a silent replacement.
3. Run `node scripts/render-meeting-voices.mjs --approved` to fill the missing
   human takes. Existing takes are reused, not billed or regenerated.
4. Listen to each new take: pronunciation, human delivery, clipped endings,
   unnatural pauses, character consistency. Set an accepted take's `status` to
   `approved`; rejected takes stay out of production. Do not infer subjective
   quality from a successful decode or a nonzero waveform.
5. Export with `node scripts/export-meeting-voice-bank.mjs /tmp/approved-meeting-voices.json`.
   This refuses unapproved casts and missing/unreviewed takes for any meeting.
6. Export `library` from `scripts.js` to `/tmp/meeting-scripts.json` as before, then
   run `python scripts/render-meeting-season.py --voice-bank /tmp/approved-meeting-voices.json`.
   The timeline is rebuilt from real durations; captions, speaker borders,
   robot mouth cues, and ducking follow the new audio. Robot lines still use the
   established renderer. Omitting `--voice-bank` retains the original season.

Natural speech is not singing. Short choruses can be rhythmically arranged; a
long line should never be squeezed into an arbitrary beat length. The existing
chorus renderer resamples phrases and needs listening review with the new cast.
Human video plates remain approximate turn-cued performances, not phonetic lip
sync. Featured close-ups need dedicated audio-driven lip sync to final audio.

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
separate: neither a new script nor a new render silently becomes a live meeting.
