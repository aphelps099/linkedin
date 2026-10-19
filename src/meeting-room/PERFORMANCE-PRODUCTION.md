# Dialogue-specific character performances

The reusable speaking plates are approximate turn cues, not lip sync. Generating
another generic talking loop will not fix that limitation. Keep the approved
human voices and make facial performances from those exact recordings.

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

## First complete meeting

Finish `standup-0` before expanding to the season. It contains four solo human
turns: Kevin's new folder, Keys' shared drive, Operations' renamed folder, and
Kevin's access question. The chorus needs each human's own exact vocal stem,
including its beat-aligned gaps. The mixed chorus is not a valid driver for an
individual character. Preserve the real musician instrument clips between lines.

Runtime bindings must use the exact `source.take` and `source.masterSha256`,
not just the speaker name or the caption text. A speaking clip's clock is the
meeting clock minus that cue's start, with an explicit lead-in offset. Pause and
seek must affect the video. Never loop a speaking performance past its sentence,
stretch an approved voice to fit a video, or mark generic footage as lip-synced.

After the first complete meeting passes review, reuse identical validated takes
and render the remaining unique lines. Keep human identity and voice settings
fixed. Frame each person clearly, with subtle facial motion and dry delivery.

## Robot treatment

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
