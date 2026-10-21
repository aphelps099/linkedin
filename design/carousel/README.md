# Learn palette / homepage carousel artwork

Status: installed in the homepage's eight existing dispatch cards. Carousel
dimensions, spacing, radii, controls, captions and media behavior remain unchanged.

`src/home-2/CarouselArtwork.jsx` renders inside the existing `.dispatch-art`
container. It uses real text, including individual
highlighted lines, over separate decorative art. Colors are scoped to the
artwork; they do not override existing site-wide tokens.

The palette uses Learn's cobalt `#0757ec`, Synergy label yellow `#ffe16b`,
callout butter `#fff7d9`, and page paper `#fbf9f0`. Sky `#9cc8f4` already appears
in the carousel and echoes the hook artwork. Orange `#ff8a48` is the normalized
accent from the record artwork. Black `#080a0e` is the existing footer.
Use cobalt, sky, black and paper most often; yellow for highlights and occasional
cards; orange sparingly. These approved colors remain scoped to carousel artwork.

The six proof cards preserve the palette review. Live art is mapped in
`src/home-2/dispatches.js`, preserving story IDs, media URLs and player handlers.
The two new backgrounds in `public/home-2/artwork/` are text-free edits of the
approved generated sketches: a white halftone chair on cobalt, and a blue
wireframe envelope on black. Both were edited with built-in imagegen and
compressed to WebP with Sharp. All wordmarks, headlines, highlights and footnotes
are separate DOM elements. The remaining motifs use CSS; the film retains its
existing poster. No complete card screenshots are embedded.

`palette-proof.html` is self-contained. Regenerate it and the in-chat fragment:

    node scripts/render-carousel-palette-proof.mjs /workspace/linkedin-beats-palette.html

Verification: production build succeeds. Browser checks confirm all eight live
cards load, real text has no horizontal overflow at desktop and 390px viewport,
and existing article and music dialogs open. Square / 16:9 art and 24px desktop
radius remain unchanged, as do mobile's 20px radius and 72vw / 82vw widths.
