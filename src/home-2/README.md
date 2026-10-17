# LinkedIn Beats homepage

The approved Home 2 design is now the public homepage at `/`, mounted by `src/main.jsx`. The former `/home-2/` page permanently redirects to `/` in production, preserving query strings and browser fragments. Its artwork and fonts remain under `/home-2/`. The HTML entry is retained as a canonicalized static-host fallback. Header/footer home links and store section links point directly to `/`.

## Interaction

The opening office film uses Mux playback ID `jjICCaXD1dLmDApUXumm9CgiESKPGJYoEAeYb2x6wf00`. `HeroVideo.jsx` streams adaptive HLS with native Safari playback and a dynamically loaded HLS.js fallback. The film fills 78% of the stable viewport height, with white transparent navigation over it. The original blue hero is section two, visible below the film; the shop section follows the music player directly. The jargon marquee is currently removed from the page. Other routes retain their solid navigation.

The current film is silent and loops muted without a visible pause control. A play-only fallback appears when autoplay is blocked or reduced motion is enabled. Sound controls remain implemented but hidden behind `HAS_AUDIO = false`; enable them when the final audio version replaces this playback ID (also update the poster preload in `index.html`). Reduced-motion visitors see a poster until they press play. Playback pauses outside the viewport and in hidden tabs. When sound is enabled in a future version, starting the radio mutes the film and enabling film sound pauses the radio. A failed stream retains its poster and all page navigation.

Four portraits select existing radio arrangements. The fifth remains available in All tracks. The player uses `src/home/radio.js` unchanged: recorded phrase clips, pause/resume, seek, volume and track changes. Radio audio never autoplays.

`portraitRadio.js` reads each decoded vocal's RMS envelope and uses the existing estimated word timings to choose among six mouth shapes. This is stylized lip sync, not phoneme alignment. Silence closes the mouth; pause and reduced motion show the rest image. All timing is derived from the audio transport. A separate animation timer cannot drift after a seek.

The artwork is the approved generated six-state study (2026-10-15). `public/home-2/singing-states.webp` is a format-compressed copy, with no resizing or rearrangement. CSS crops one fixed base portrait and overlays only a feathered mouth patch from another cell. Color treatments are applied to the entire portrait. The other facial features remain fixed.

The larger choir now uses `portrait-turn.webp` for a brief illustrated head-turn crossfade at the start of playback, followed by the existing vocal-driven mouth patches. This is a two-pose illustration, not a 3D model. The turn, equalizer accents and mouth motion respect the animation switch and reduced-motion preference. The selected singer is raised and outlined. The hero CTA, masthead button and ivory player all control the same audio transport. The waveform contains the native range input, so pointer and keyboard seeking remain available without a separate progress rail. Desktop playback includes the selected singer's thumbnail and larger time labels.

The LinkedInifier uses the existing `linkedinify` function. Merchandise links to the current store's three preview products; no prices or order availability are invented.

## Campaign revision

The concept has its own approved record-label header. Outlined vector wordmarks use a horizontal lockup on desktop and a stacked lockup on mobile; the footer and favicon share the identity. `scripts/make-record-label-logo.mjs` maintains the original letter paths. The compact header exposes Listen, LinkedInifier and Shop on wide screens, with a four-link dropdown including Studio on every viewport. Listen and LinkedInifier anchor to this page; Shop and Studio open the existing routes. The radio button controls the existing transport and shows loading, playing and paused states. Escape returns focus to Menu, outside clicks and focus leaving the header dismiss the dropdown, and Arrow Down opens it at its first link. Existing pages retain their shared navigation. The portrait animation switch lives inside All tracks.

The merchandise section keeps the original three product images, complete product framing, and direct product links. The approved black campaign treatment uses a centered heading, subtle graph paper and matte grain, three equal image stages, clear product labels, and a centered collection link. A one-pixel ivory divider separates it from the music player. On smaller screens the products stack with consistent framing. The collection remains clearly marked as a preview. A navy LinkedInifier follows with a working before/after announcement. The initial coffee example opens with the three paragraphs in the approved preview; its continuation uses the existing engine. Every submitted input and alternate example uses that engine. Editing clears the previous result, and the examples, copy action, clipboard fallback, and studio handoff remain usable. The form has separate React state so audio animation updates do not rerender its contents. Roast has been removed from this concept; its standalone route is retained.

The compact revision uses the site's existing Anton headline face throughout the hero, store and campaigns, with TT Hoves for body text and lyrics. Serif italics are removed. Desktop campaigns target an approximately 2.2:1 composition with restrained paper grain; mobile layouts and expanded content grow naturally. The LinkedInifier previews three paragraphs with a Read full post control. Copy and studio actions always use the complete output; clipboard fallback expands the post before selecting it.

The LinkedInifier has a cream input, cobalt action and a separate paper output with consistent body typography. `robot-paper-top.webp` combines the robot, rubber stamp, contact shadow and paper's top edge in one transparent 3:1 illustration. The blank lower strip blends into the HTML card. The artwork remains stationary, so generation never pulls the paper join apart; the fictional APPROVED impression still animates independently and respects reduced motion. Editing removes the previous approval. Output remains immediate, and animations never delay copying or reading. The artwork is loaded by the homepage.

The fidelity revision measures the LinkedInifier against the approved 1774 × 887 image: 77px outer margin, 733px left column, 54px gutter and 833px sheet. One CSS scale unit keeps these relationships consistent on desktop; below 900px the form and output reflow. The subsequent scale refinement reduces the desktop left column and its contents to 95%, while tightening the section's vertical gaps. Only BIG DEAL receives a short layered blue extrusion and a soft cast shadow. The approval mark is an outlined Anton SVG with a single distressed border. The hero and player preserve the reference's headline scale, selected portrait proportions, thumbnail, waveform and centered navigation.

The integrated artwork replaces the earlier clipped foreground layer after the user identified a visible notch at the robot's wrist. See `artwork/robot-paper-top.md` for the saved asset and generation brief.

The concept footer uses a quiet corporate-stationery layout, parody fine print, and original fictional assurance marks. The creator credit links to Look Serious; the LinkedIn icon links to Aaron's personal profile. The portfolio-domain link is removed.

## Typography provenance

- TT Hoves Pro Regular / DemiBold: user's `aphelps099/sbdc-advisor`, `design_handoff_learn_v2/fonts/`.
- GT America Extended Medium / Mono Regular: user's `aphelps099/look-serious`, `design-system/assets/fonts/`.
- GT Alpina Fine Condensed Light Italic: user's `aphelps099/aaroncphelps`, `fonts/`.

The Hoves and America files are Latin subsets. Font families and styles remain scoped to the homepage and shared store components.

## Checks

`npm run check:home` verifies the existing transport. `npm run check:home2` verifies vocal-only motion, silence/pause, frame mapping, all real clip arrangements and adapter lifecycle. `npm run build` includes the production root entry. Legacy `#listen`, `#store`, and `#about` links resolve to the corresponding new sections; shared `#beat=` URLs still open the studio, and `#roast` opens the retained roast page. No audio autoplays.

The store preview now uses the complete product names, compact TT Hoves captions and larger image areas. The full `/store/` route shares the approved header/footer and links its Listen and LinkedInifier navigation back to this page. Its retail layout is documented in `src/store/README.md`.

The footer certification marks are outlined vector badges based on the supplied `image(20261015-202030).png` concept. `scripts/make-footer-seals.py` builds the three SVGs with the existing Anton font. Each mark uses a masked graphite gradient and fine grain; a single metallic highlight and small glints run when hovered. The shimmer affects only the dark artwork. Reduced-motion preferences use a static finish, and unsupported masking/forced colors retain the SVG image. The footer remains shared with `/store/`.


The LinkedInifier navigation item (desktop and menu, including the store header) and the blue homepage campaign CTA now open `/lessons/`, the full editor. The homepage campaign is an example preview: its sample field is read-only so visitors do not lose a typed draft when following the CTA. Try another ordinary moment, Read full post and Copy post still work. The lessons editor itself is unchanged.


## Expandable certificate

The homepage announcement now uses a responsive CSS gold frame: four mitered gradient rails, a dark inner edge, subtle grain and a small brass plaque. The ivory canvas contains live post text and both actions. Read full post is the dark primary button; it expands inline and becomes Show less. Copy post is the adjacent underlined secondary button and always copies the complete post. The previous Make it a beat action is removed from this component. The existing manual-copy fallback expands and selects the complete text when clipboard access fails.

The transparent `certificate-robot.webp` replaces the combined paper-top image. It preserves the approved deadpan robot, stamp and gripping hand. Width-based placement anchors its torso at the frame's upper edge; neither its scale nor its position depends on the post's height. On narrow screens controls wrap, the frame retains its bevel thickness and the text remains readable. Forced colors use a simple visible border. See `artwork/certificate-robot.md` for asset provenance.
