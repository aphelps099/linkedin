# Academy invitation — homepage and /home-5/

The opening Mux office film now carries the headline “Learn to sound like LinkedIn.” and the professional-development subhead. Its speaker On/Off button controls the same radio as the header and iPod, starts off, and exposes loading/cancel/error states. The Mux audio rendition contains silence, so it remains muted; the toggle plays the existing real arrangements rather than unmuting an inaudible track. Starting one control never layers another player.

The blue section markets the five-course Academy with “Make it official.”, “Five short courses. One very official-looking certificate.” and a persistent **Get certified** link to `/learn/`. The original two profile identities and ten-second film are retained. Eight brief vocabulary phrases rotate across four film loops. `ProfileConversation` uses the film time plus its completed loops; it reveals words from 0.55 seconds into each five-second speaker turn and fades at 4.5 seconds. A new phrase never appears on the wrong side of the film's alternating left/right rhythm.

The scene pauses when less than 30% visible, in hidden tabs, or through its Pause control. Next advances the text and seeks the corresponding speaker. Reduced motion, playback failure and autoplay blocking retain a readable static phrase and manual Next. A screen-reader transcript lists all vocabulary without continually announcing automatic changes. Mobile places the invitation above the head scene and the course link below it, keeping both faces and short phrases readable.

Asset provenance and the clean profile video are unchanged. The background is 1280×720 H.264, exactly ten seconds, with no audio track. The poster is the resting frame at four seconds.

## Homepage music campaign stage

The promoted homepage and `/home-5/` place `DevelopmentRadio` directly below the talking heads. A blue-lit product stage replaces the animated racing strip and fictional social posts. Original outlined lettering in `sound-like-business.svg` reads “SOUND LIKE YOU / MEAN BUSINESS”, with the yellow bolt and cobalt underline from the site's racing identity. TT Hoves sets the subline “Corporate jargon. Robot vocals. / Unreasonably good beats.” and player interface. A real text heading remains available to assistive technology and forced-colors users.

The decorative `music-stage.webp` is a background-only edit of the approved stage sketch: navy negative space on the left, blue spotlights on the right, and subtle carbon-fibre detail on low stage risers. There is no interface baked into it. Native diagonal stripes frame the left edge. On narrow viewports the stage artwork sits behind the lower device area and fades into the solid navy above.

The iPod is the only player in this section. The left column contains the racing headline, campaign subline and studio link. The device keeps its desktop scale, with a slightly higher crop so the center button and both skip controls remain fully visible. Mobile uses a larger product render and centers its body, keeping the LCD legible and the wheel controls at least 44px. Earbuds and the bottom of the device remain cropped.

The LCD displays the real current track, playback state, elapsed and total time, frequency bars and an accessible native seek slider. It is always visible. Its HTML panel uses the same affine screen registration as the product artwork. Native buttons sit on the click wheel: center play/pause (or cancel while loading), previous/restart and next. MENU opens a scrollable playlist inside the LCD; selection plays the chosen track. Opening focuses the selected track, Escape returns to MENU, and leaving the player closes the playlist. Choosing the already playing track keeps playback running.

The screen, wheel and device share one coordinate system, so hover and parallax do not separate the controls from the product. Hover illuminates the active button and softly lights the device. All controls use the existing radio instance shared with the header; audio never autoplays. Loading, playback failure, pause and track changes remain visible. The studio link opens `/studio/`.

The stage background is static. Device and equalizer movement respect reduced motion. Forced colors retain a readable screen and native transport controls without the product image or stage artwork.


The marquee is held for possible store or footer use and is not mounted on the homepage. `RadioRacingBanner` and its styles are retained: white TT Hoves DemiBold phrases at 76% opacity travel rightward, led by a 16×16px pixel office droid with a thin tow line and slowly blinking cyan lamp. The desktop headline, subline and studio link are nudged 24px right as one block; stacked tablet/mobile layouts retain their existing alignment.

Three identical laps, each at least the viewport width, create a seamless loop. ResizeObserver measures each lap so the speed remains 34px/second through font loading and resizes. The strip stops offscreen and in hidden tabs. Hover or keyboard focus temporarily pauses it; clicking toggles a persistent pause without affecting music. Reduced motion presents one static phrase and droid. Repeated visual copies are hidden from assistive technology.
