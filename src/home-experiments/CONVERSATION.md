# Profile conversation — /home-5/

This preview keeps the opening Mux office film, the real radio, merchandise and footer. Only the blue section changes. Two cropped profile faces alternate with word-by-word text. Headline: “Learn to speak like LinkedIn.” Subhead: “Professional development for aspiring thought leaders.”

The background is a silent, ten-second MP4. `ProfileConversation` reads its playback time directly; there is no independent text clock to drift. The man speaks in the first half and the woman in the second half. The text begins at 0.55 seconds into each turn, reveals every 385 milliseconds, holds, then fades at 4.5 seconds. There is no speech audio in this layer. The music player remains independently controlled.

The loop pauses when less than 30% of the section is visible, or when the document is hidden. There is no visible pause button. Speaker controls replay either half. Reduced motion uses the static poster and complete readable text, with manual speaker selection. A static transcript supports screen readers. Failed or blocked playback also keeps the poster and text usable.

On narrow screens the heading sits above the face scene. Both profiles remain visible, and the center stays clear for text. Fonts and player controls use the existing site design.

Asset provenance: the clean plate was edited from the approved imagegen mockup `exec-3acffabf-e03b-4411-a112-80b20a425d65.png`, keeping the two identities and removing all baked-in interface/text. Clean plate: `exec-654be3a0-641c-4e81-9e5b-4cb4e01f06f9.png`. Runway motion task: `5fa307f2-9969-44d3-b7c3-2158782359c9`. The prompt requests a locked camera, unchanging head scale and positions, only restrained lip/jaw movement and occasional blinking, alternating left then right, no audio, no graphics, and identical first/last frames.

Production delivery: source film trimmed to exactly ten seconds, resized to 1280×720, encoded H.264 CRF 26 with a fast-start MP4 header and no audio track. The poster is exported from the resting frame at four seconds, so the live film and fallback retain the same appearance.

## Homepage music campaign stage

The promoted homepage and `/home-5/` place `DevelopmentRadio` directly below the talking heads. A blue-lit product stage replaces the animated racing strip and fictional social posts. Original outlined lettering in `sound-like-business.svg` reads “SOUND LIKE YOU / MEAN BUSINESS”, with the yellow bolt and cobalt underline from the site's racing identity. TT Hoves sets the subline “Corporate jargon. Robot vocals. / Unreasonably good beats.” and player interface. A real text heading remains available to assistive technology and forced-colors users.

The decorative `music-stage.webp` is a background-only edit of the approved stage sketch: navy negative space on the left, blue spotlights on the right, and subtle carbon-fibre detail on low stage risers. There is no interface baked into it. Native diagonal stripes frame the left edge. On narrow viewports the stage artwork sits behind the lower device area and fades into the solid navy above.

The iPod is the only player in this section. The left column contains the racing headline, campaign subline and studio link. The device keeps its desktop scale, with a slightly higher crop so the center button and both skip controls remain fully visible. Mobile uses a larger product render and centers its body, keeping the LCD legible and the wheel controls at least 44px. Earbuds and the bottom of the device remain cropped.

The LCD displays the real current track, playback state, elapsed and total time, frequency bars and an accessible native seek slider. It is always visible. Its HTML panel uses the same affine screen registration as the product artwork. Native buttons sit on the click wheel: center play/pause (or cancel while loading), previous/restart and next. MENU opens a scrollable playlist inside the LCD; selection plays the chosen track. Opening focuses the selected track, Escape returns to MENU, and leaving the player closes the playlist. Choosing the already playing track keeps playback running.

The screen, wheel and device share one coordinate system, so hover and parallax do not separate the controls from the product. Hover illuminates the active button and softly lights the device. All controls use the existing radio instance shared with the header; audio never autoplays. Loading, playback failure, pause and track changes remain visible. The studio link opens `/studio/`.

The stage background is static. Device and equalizer movement respect reduced motion. Forced colors retain a readable screen and native transport controls without the product image or stage artwork.


The marquee is held for possible store or footer use and is not mounted on the homepage. `RadioRacingBanner` and its styles are retained: white TT Hoves DemiBold phrases at 76% opacity travel rightward, led by a 16×16px pixel office droid with a thin tow line and slowly blinking cyan lamp. The desktop headline, subline and studio link are nudged 24px right as one block; stacked tablet/mobile layouts retain their existing alignment.

Three identical laps, each at least the viewport width, create a seamless loop. ResizeObserver measures each lap so the speed remains 34px/second through font loading and resizes. The strip stops offscreen and in hidden tabs. Hover or keyboard focus temporarily pauses it; clicking toggles a persistent pause without affecting music. Reduced motion presents one static phrase and droid. Repeated visual copies are hidden from assistive technology.
