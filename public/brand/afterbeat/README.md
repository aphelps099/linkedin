# LinkedIn Beats — Afterbeat

Approved direction: lowercase TT Hoves DemiBold, with a compact terminal underscore.

## Use the artwork

- `wordmark-color.svg`: primary logo on white or light neutral backgrounds. “linkedin” is Ink; “beats” and the terminal beat are Cobalt.
- `wordmark-black.svg` / `wordmark-white.svg`: single-color applications. Use white over dark footage, blue backgrounds, and the certificate masthead.
- `stacked-*.svg`: compact two-line layout. Keep the underscore only after “beats”.
- `monogram-*.svg`: transparent square canvas containing `lb_`, for seals and compact brand placements.
- `icon-blue.svg` / `icon-black.svg`: square avatar and app icon with white `lb_`.
- `academy-*.svg`, `studio-*.svg`, `store-*.svg`: the master wordmark paired with a department label. Use the full lockup when the parent brand is not already established.
- `png/`: transparent PNG companions at 2400px width (monograms 1000px, icons 512px), plus 16, 24, 32 and 180px icon exports.
- `identity-guide.svg` / `.png`: visual overview.
- `tokens.css`: color tokens and an optional, reduced-motion-aware interaction pulse.

All SVG lettering is outlined from the project's actual TT Hoves DemiBold font. It does not depend on webfont loading. The PNGs have transparent backgrounds except the filled icons and identity guide. The font itself is not included.

## Palette

| Color | HEX | RGB |
| --- | --- | --- |
| Ink | #111111 | 17, 17, 17 |
| Cobalt | #0757EC | 7, 87, 236 |
| Warm white | #FAFAF7 | 250, 250, 247 |
| White | #FFFFFF | 255, 255, 255 |

Use the all-white logo on dark or photographic backgrounds. These are RGB masters; choose a printer-specific CMYK conversion and proof Cobalt on the actual substrate.

## Proportions and spacing

The terminal beat is a drawn rectangle, deliberately placed closer to the baseline than the font's underscore. Keep its size, position and spacing as supplied. Never stretch the logo, detach its beat or set a second underscore manually.

Leave clear space equal to the lowercase b's height around the logo when possible. Compact navigation may use half that height. Suggested minimum digital widths: horizontal wordmark 160px, stacked wordmark 88px, icon 24px. The dedicated 16px favicon is the only exception. Verify physical proofs before very small embroidery or printing.

## Voice and movement

The logo stays composed. Humor comes from the copy: “Considerable effort.” “Professional development, allegedly.”

Use one restrained 700ms pulse on a deliberate interaction, if appropriate. Keep the logo still at rest; honor reduced-motion preferences. Avoid perpetual blinking or equalizers inside the wordmark.

## Rebuild

From the project root:

    python3 scripts/build-afterbeat-identity.py
    node scripts/package-afterbeat-identity.mjs

The generator requires Python fonttools and Pillow. PNG and ZIP packaging also run automatically during `npm run build`, using Node and the project's existing Sharp dependency; Python is only needed to change the outlined masters. Original TT Hoves font files stay inside the project and are not included in this kit.
