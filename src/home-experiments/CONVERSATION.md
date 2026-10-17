# Profile conversation — /home-5/

This preview keeps the opening Mux office film, the real radio, merchandise and footer. Only the blue section changes. Two cropped profile faces alternate with word-by-word text. Headline: “Learn to speak like LinkedIn.” Subhead: “Professional development for aspiring thought leaders.”

The background is a silent, ten-second MP4. `ProfileConversation` reads its playback time directly; there is no independent text clock to drift. The man speaks in the first half and the woman in the second half. The text begins at 0.55 seconds into each turn, reveals every 385 milliseconds, holds, then fades at 4.5 seconds. There is no speech audio in this layer. The music player remains independently controlled.

The loop pauses when less than 30% of the section is visible, when the document is hidden, or when the visitor pauses it. Speaker controls replay either half. Reduced motion uses the static poster and complete readable text, with manual speaker selection. A static transcript supports screen readers. Failed or blocked playback also keeps the poster and text usable.

On narrow screens the heading sits above the face scene. Both profiles remain visible, and the center stays clear for text. Fonts and player controls use the existing site design.

Asset provenance: the clean plate was edited from the approved imagegen mockup `exec-3acffabf-e03b-4411-a112-80b20a425d65.png`, keeping the two identities and removing all baked-in interface/text. Clean plate: `exec-654be3a0-641c-4e81-9e5b-4cb4e01f06f9.png`. Runway motion task: `5fa307f2-9969-44d3-b7c3-2158782359c9`. The prompt requests a locked camera, unchanging head scale and positions, only restrained lip/jaw movement and occasional blinking, alternating left then right, no audio, no graphics, and identical first/last frames.

Production delivery: source film trimmed to exactly ten seconds, resized to 1280×720, encoded H.264 CRF 26 with a fast-start MP4 header and no audio track. The poster is exported from the resting frame at four seconds, so the live film and fallback retain the same appearance.

## Professional development radio section

The profile preview now places `DevelopmentRadio` in its own navy section (matching Small news) directly after the conversation. TT Hoves sets all section text. A flat white inline SVG iPod, with the LinkedIn mark on its screen, is cropped near its upper wheel; white wired earbuds sit alongside it, with a softly blurred post/reaction card behind both. Fine-pointer hover lifts the device 8px and eases its tilt from -7 to -4 degrees; reduced motion disables this. Mobile stacks the copy/player above the cropped illustration.

The compact transport shares the existing radio instance and header controls. It exposes only the current track, total duration, previous/restart, play/pause, next, and an accessible seek slider. Titles fade in when the selected track changes. No playlist expands. The studio link opens `/studio/`. Other homepage variants retain their existing player.

The decorative reaction card cycles Like, Love and Insightful every 1.55 seconds, increments one count per press, and resets its counts after 36 presses. It contains no comments or profile portraits. Its interval pauses offscreen, in hidden tabs, and under reduced motion. The iPod and earbuds remain sharp above the blurred card.

The listening kit uses a transparent 3D product render (`ipod-earbuds-3d.webp`), replacing the flat SVG device and earbuds. A single asset preserves connected cords and proportions during the subtle hover movement.

The listening kit is also a play/pause button, connected to the same radio as the compact transport and header. Hover or keyboard focus adds a soft blue-white glow and replaces the screen artwork with a perspective-aligned LCD overlay: equalizer, “Listen,” and “Click to play beats.” The hover equalizer is a visual preview; while playing, its 16 bars use the radio's actual frequency levels, and the prompt becomes “Click to pause.” Loading shows “Tuning in…” with a cancel action. Touch devices always show the screen prompt. Reduced motion keeps the screen static, and the existing transport remains available in forced-colors mode.

The iPod and connected earbuds enter with a scroll-linked upward parallax movement, starting up to 120px below their resting position (72px on mobile). The movement eases to exactly zero when the stationary artwork container reaches 45% of the viewport height, then remains at the original layout position as scrolling continues. The reaction post stays in place behind it. Scroll translation is independent of the hover tilt/lift, updates at most once per frame near the viewport, and is disabled for reduced motion. Direct links into the section calculate the correct position before paint.
