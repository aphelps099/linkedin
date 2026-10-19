# Dialogue-specific character performances

The reusable speaking plates are approximate turn cues, not lip sync. Generating
another generic talking loop will not fix that limitation. Keep the approved
human voices and make facial performances from those exact recordings.

## Approval lock, 2026-10-19

The current Synergy camera is final and user-approved. Do not regenerate, redesign,
or change his display. Kevin’s exact-voice pilot is also user-approved and is the
reference for the remaining human performances. Preserve all approved voices.

## First test

`assets/meeting-performances/kevin-pilot/pilot.json` records the exact voice take,
source hash, photo, dialogue, duration and review requirements. Its WAV has the
same outer-silence trim as the live meeting cue. No music is included in the
performance input; the Studio adds its instrumental bed separately.

Use Runway **Character Script to Video**, Audio mode, with Kevin's current photo
and the prepared WAV. This app accepts an uploaded audio file. The currently
connected generation tools do not expose that input; the Runway web editor
requires its own sign-in. Do not replace the approved voice with model-generated
dialogue to work around the missing audio input.

Review the pilot at normal speed with sound and frame by frame around M/B/P
closures. Check silence, jaw/teeth stability, attached lips, headset position,
face identity, and the first and last frames. A completed generation is not
automatically an accepted performance.

The first Kevin pilot is now rendered and bound to its exact take in
`performances.js`. Output audio aligns with zero measured lag and 0.99998 waveform
correlation to the approved input; Studio still plays its original voice master.
The video supplies only the face performance and is always muted in the meeting.
The editor reframed this shot closer to Kevin's face. His ordinary guitar footage
continues outside the sentence. Do not use this one performance for other words.

`SpeechPerformance.jsx` preloads the next validated line after Play, seeks its
video from the meeting's audio clock, preserves the corresponding paused frame,
and never loops the sentence. Missing performances retain the existing generic
motion plates. The first variants of Stand-up, Onboarding and Unlocking potential
now have exact performances for every human solo turn and chorus. The two
paperless meetings contain only robots and the printer. The remaining nine
meetings with humans still need line-specific performances; the season is not
yet fully lip-synced.

## First complete meeting

`standup-0` is the first complete human performance set. It contains four solo human
turns: Kevin's new folder, Keys' shared drive, Operations' renamed folder, and
Kevin's access question. The chorus needs each human's own exact vocal stem,
including its beat-aligned gaps. Each person now has that isolated driver. The
mixed chorus is not a valid driver for an individual character. The real musician
instrument clips continue between lines.

`assets/meeting-performances/standup-0/` stores the exact input WAVs, source video,
per-line offsets, source hashes, chorus timing and review records. Three renders
cost six credits total. All output audio has zero measured lag and correlation
above 0.9998 against its input. Runtime uses muted videos and the unchanged
approved meeting audio. No new Synergy assets or voices were made.

`prepare-standup-performances.py` reconstructs the isolated inputs from approved
masters without writing live audio. `package-standup-performances.py` validates
returned audio and writes delivery media plus `standup-performances.js`. Chorus
matching checks every participant’s source and the total duration: changing any
voice can change beat spacing, so it invalidates the existing chorus footage.

Runtime bindings must use the exact `source.take` and `source.masterSha256`,
not just the speaker name or the caption text. A speaking clip's clock is the
meeting clock minus that cue's start, with an explicit lead-in offset. Pause and
seek must affect the video. Never loop a speaking performance past its sentence,
stretch an approved voice to fit a video, or mark generic footage as lip-synced.

After the first complete meeting passes review, reuse identical validated takes
and render the remaining unique lines. Keep human identity and voice settings
fixed. Frame each person clearly, with subtle facial motion and dry delivery.

## Onboarding performance set, 2026-10-19

`onboarding-0` ("Optimizing the onboarding", 40.8 seconds) now has exact human
performances for People & Culture's two lines, Strategy's question, Keys' capacity
line, Kevin's question, and all five humans' isolated chorus stems. Five renders
cost ten credits. The approved meeting audio is unchanged; measured returned
audio lag is zero, with waveform correlation above 0.9997 for every output.
Synergy and Synthia retain their established media and voices.

`prepare-meeting-performances.py` reconstructs all human solos and chorus timing
from the approved masters. Both robot voices participate in measuring the chorus
slots; they are not regenerated for live playback. `package-onboarding-performances.py`
validates the audio and exports exact take/hash bindings and offsets. The shared
runtime supports the reviewed chorus sets, never matching caption text alone.

Keyboard framing is a production requirement. Do not crop out hands/keys or
cover the entire keyboard with a name strip. The original instrumental masters
already contained the keyboard: `restore-keyboard-framing.py` restores that
framing. Her compact corner name leaves the instrument visible. During exact
speaking performances the tile shows a separate keyboard detail camera below
the talking view; this is an editorial two-camera layout, not a pasted-on mouth.
The detail camera is approved instrumental motion, not note-for-note MIDI sync.
It follows play, pause and seek and does not consume new generation credits.

The wider reference was prepared with the built-in image-generation tool, but
Character Script to Video still reframed it to the face. Preserve the reference
and review notes so a later full-frame performance workflow can use it. Do not
silently claim that this renderer retained the keyboard in its speaking shot.

Direct review link: `/studio/?meeting=onboarding-0`. The default is still the
first stand-up; Next meeting advances through the existing sequence.

## Unlocking potential performance set, 2026-10-19

`unlock-0` ("Unlocking our collective potential", 40 seconds, 108 BPM) is the
next meeting after onboarding. Its twelve tiles include seven human singers.
Exact performances cover Arjun's question, Kevin's second tab, Keys' excitement,
Strategy's third tab and Linda's closing question. All seven humans have their
own isolated, beat-aligned chorus drivers; People & Culture and Operations only
sing in that chorus. Linda's closing solo is before her chorus in the source
file, so playback must seek back to its correct offset after the group refrain.

Seven renders cost fourteen credits, bringing this approved 2,000-credit asset
allocation to 1,994 spent. Do not confuse this production allocation with the
workspace's larger account balance. No new voices or robot plates were generated.
The approved voice masters and instrumental mix remain unchanged.

`assets/meeting-performances/unlock-0/` stores prepared WAVs, original generated
video, task/asset IDs, hashes, cue offsets and measured audio alignment.
`package-unlock-performances.py` checks audio correlation/zero lag and writes
720p delivery media plus `unlock-performances.js`. The keyboard uses the same
approved wide reference and retains its separate instrument detail during speech.
Reviewed frames preserve attached lips, headset placement, character identity
and natural blinks. Runtime checks cover solo/chorus timing, source invalidation,
the closing Linda line, and the deterministic next-meeting link.

Direct review link: `/studio/?meeting=unlock-0`.

The twelve-person chorus exposed excessive simultaneous decoding in live review.
Pause each human's hidden background camera once its exact performance becomes
visible, and resume it when that performance ends or fails. The independent
keyboard detail continues. Unlock delivery clips use one-second keyframes and
no B-frames so group seeks do not repeatedly decode long preceding GOPs. Source
masters retain their original encoding.

## Paperless transformation review, 2026-10-19

`paperless-0` is the fourth meeting: 37.1429 seconds, 84 BPM, DOS keys and printer
percussion. Synergy and Synthia retain the approved distinct voices and existing
character cameras. The printer remains silent and continues feeding LinkedIn
sheets onto its persistent stack throughout the conversation and chorus.

The duet now has independent 25 Hz vocal envelopes: each robot's fixed-height
horizontal display follows its own recording, not the summed chorus. Solo cues
retain their existing envelopes. The approved MP3, music, cue times, tracking,
mouth geometry and all video assets are unchanged. No new Runway credits or Mux
assets were used; the entire update adds less than 1 KB of envelope data.

`render-meeting-season.py --voice-bank /tmp/approved-meeting-voices.json
--meeting paperless-0 --metadata-only` recreates the original synthesis order in
memory, verifies exact cue timing and source profiles, and checks the reconstructed
voice track against the existing MP3 before writing animation metadata. The
measured zero-offset correlation was 0.9999776; the validation record and unchanged
audio SHA-256 are in `assets/meeting-performances/paperless-0/display-validation.json`.
This mode does not replace any audio. Full future renders also emit individual
chorus envelopes so new recordings cannot silently retain stale mouth timing.

Direct review link: `/studio/?meeting=paperless-0`. Next meeting continues to the
first Founder update, without shuffling.

## Robot treatment (unchanged)

Synergy is a separate production problem. Generate a stable physical performance
with a clean rigid black screen, then track the screen and composite the speech
display from the real vocal envelope. Keep two small green eyes high on screen.
The mouth is one fixed-height horizontal row near the bottom: light travels
left to right. Energy changes brightness, not height. No vertical expansion,
human lip shapes, floating patches, altered metal, or green light on the chassis.

Maintain the same ivory/chrome body, scale, headset, lanyard and coffee cup. The
badge must read SYNERGY. Synthia remains her established distinct character.
Review robot plates across the whole shot, including loop joins and silent cues.

### Approved Synergy camera revision, 2026-10-19

The user approved `synergy-camera-v2`. The source master and exact prompt are in
`assets/meeting-performances/synergy-v2/`. Its restrained physical motion runs
forward then backward for a matching loop boundary. The original green eyes,
glass border, headset and metal are preserved. Only the generated decorative
mouth dots are removed before encoding, using a tightly bounded mask and nearby
glass pixels. Live speech needs no opaque patch on this new plate.

The 22-LED mouth remains six pixels high at the 1280×720 working resolution.
Only brightness and left-to-right phase change with speech. Review all 408
frames of tracking when revising this clip. The original camera plate is retained
as an archive; Synthia's media and approved human voices are unchanged.

References checked 2026-10-19:
- https://help.runwayml.com/hc/en-us/articles/51285026291219-Character-Script-to-Video
- https://help.runwayml.com/hc/en-us/articles/42311337895827-Performance-Capture-with-Act-Two
