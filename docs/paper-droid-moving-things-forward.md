# Paper droid — Moving Things Forward

## Character correction

The user clarified that the requested solo song belongs to the small floor droid that tows the paper cart, not Synergy. The previous Synergy film was based on a mistaken interpretation. This is the corrected project.

Canonical reference: `public/cutting-room/posters/office-droid-delivery-ede78e46.jpg` and `public/studio/season/posters/droid.jpeg`. Preserve the squat cream canister body, silver/cream dome, dark visor, blue horizontal stripe and small blue panels. No humanoid limbs, expressive face or Synergy armor. Keep its practical metal tow bar visibly connected to the paper trolley.

## Art and song

A solemn career announcement about transporting printed materials from one part of the office to another. The refrain is “Moving things forward.” The existing original 96 BPM score is reused; the robotic vocal is newly recorded to the revised words. Production research remains in `synergy-the-report-is-attached.md`, but its character and report narrative do not apply to this film.

Floor-level observational shots, ordinary beige cubicles and navy carpet, subtle workers in the background. The cart, tow bar and stacks must retain their geometry and scale. Motion is steady wheeled translation and a measured stop. No dancing, cute reactions, dramatic flourishes, paper growing or disconnection. No baked-in text; optional captions only.

## Lyrics

Humbled to share an important delivery.
Today, I delivered the team’s printed materials.
From one part of the office to another.

What looked like a simple request
became an opportunity to connect our teams.
Different functions. Shared direction. One trolley.
There were obstacles. Mostly chairs.
But we kept moving.

Moving things forward.
Moving things forward.

Grateful to everyone who cleared a path.
Especially the colleague who moved the bin.
We challenged how things had always been carried.
We took a wider view of the corridor.

At nine oh three, the paper arrived.
Exactly where the paper needed to be.
Proud of the delivery. Prouder of the journey.
The next chapter is already in the tray.

Moving things forward.
Moving things forward.

Looking forward to taking this further.
Once I’ve recharged.

## Files

Local project: `/Users/ap457/Projects/linkedinbeats-meeting-art/optimizing/paper-droid-song/`.
Review: `http://127.0.0.1:8852/paper-droid-song/`.
Current master: `output/moving-things-forward-refined.mp4`. Earlier beep mix: `output/moving-things-forward-beeps.mp4`. Earlier no-beep mix preserved as `output/moving-things-forward.mp4`.
The approved printer film and its sound comparison remain unchanged. The refined master is included in the October 28 Cutting Room release as `moving-things-forward-7fdb2147`.

## Shot review

The first generated arrival shot stretched the tow bar as the droid and trolley changed relative position. It is excluded from the final edit and retained locally as `ending-rejected-tow-drift.mp4`. A stationary parked ending replaces it. The film uses a newly generated pass based on the original catalog still, plus matching floor-level and hitch shots.

## Final verification

The corrected master is 60.00 seconds at 1280×720 / 24 fps, with seven cuts and no repeated or reversed source intervals. Full file decode succeeded. Measured decoded audio is −15.72 LUFS and −1.46 dBTP. Browser playback, refrain seeking, duration and media readiness were checked. This is technical verification, not a subjective listening review. All spoken lines fit their assigned bars without overlap.

Video tasks: original-reference pass `c144debf-1d53-4b46-aff4-9b485f226506`; low tracking view `d9568a22-04e3-4a66-a1b1-6596a9e3c5c1`; hitch `c4fabd2b-84e2-464c-89dc-be03c5b67ef4`; rejected arrival `2bcfd778-6735-4b88-8975-16dd16df6abd`; replacement parked ending `ffaeb00f-3497-4208-951e-42fb7ce0e270`. Runway reported 730 credits used for these five generations. The prior original score was reused; no additional music generation was needed.

## Robotic beep revision

User requested robotic beeps in the song. Added 21 short, original synthesized FM tones arranged as machine acknowledgements: introduction, selected gaps between spoken lines, paired responses to “Moving things forward,” and a final low pair after “Once I’ve recharged.” Tones use 5 ms attacks and 18 ms releases to avoid clicks, modest metallic harmonics, near-center placement and no long cartoon glissandos. Every tone is outside the spoken voice envelopes with at least 60 ms separation. The separate beep stem is `output/beeps-60s.wav`; the revised audio is `output/mix-beeps-60s.wav`. `add_beeps.py` reproducibly builds the revision from the existing voice and score stems. The video stream is copied unchanged and hash-verified. No new Runway generation was needed.

## Requested polish: vocal clarity and undercarriage cleanup

The user approved the concept, lyrics and video, requesting only 5–10% clearer voice and removal of the rotating white cloth/pad visible under the droid at 3–4 seconds. The robotic voice had no added echo or reverb in the existing mix; its hollow coloration was reduced with −2.2 dB at 480 Hz (Q 0.85) and +1.5 dB at 2.4 kHz (Q 0.8). Vocal stem RMS was then set to exactly 1.08 times the original. The original voice performance, wording and timing are retained. Score and beep stems are unchanged. Revised stem and mix: `output/robot-clear-60s.wav`, `output/mix-clear-beeps-60s.wav`; reproducible script: `clarify_voice.py`.

The affected original ten-second source shot appears at 0–10 seconds and 25–30 seconds in the edit. The pad-removal repair is applied to both uses, with the same trims and speeds. The first repair darkened the pad instead of removing its geometry and was rejected (`cleanup/rejected-dark-disc.mp4`). The second keyframe removes the pad entirely, restoring carpet and normal small wheels. Repair tasks: rejected `ae4db943-c37c-406f-966f-778f3d5f2c07`; corrected `9faf466c-7c65-4e67-bb31-29a34df9161c`. The rest of the shot sequence is retained; previous masters remain available.

Final compositing method: the second generated video removed too much of the droid, so it was used only as a clean carpet plate. `cleanup/composite_undercarriage.py` tracks the original blue belt and warm shell boundary frame by frame, and blends the clean carpet only inside a feathered underside matte with a soft contact shadow. The original droid, small casters, tow bar, trolley, people and background remain the base image. Neither full generative removal pass is used as the final shot. The revised sequence is assembled by `render_refined.py`; it retains the original cut list and uses the clearer voice mix with the same music and beeps.

Refined master verification: full decode passes at 60.00 seconds, 1280×720 / 24 fps. Measured decoded audio is −15.76 LUFS and −1.39 dBTP. Original and refined edit-decision lists match exactly. Inspected repaired frames at 3.0, 3.5, 4.0 and 28.0 seconds, plus the tracked source sequence. Browser playback and seeking verified against `moving-things-forward-refined.mp4`. Voice-clarity measurements are in `output/voice-clarity.json`; export checks are in `output/verification-refined.json`. Earlier masters are preserved.
