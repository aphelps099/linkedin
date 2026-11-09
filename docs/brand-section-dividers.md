# Section dividers

Approved direction, November 9, 2026:

- Use spacing as the default section separator. Avoid traditional thin horizontal rules and hairline dividers in the PEG-grid experience.
- Save the soft pixel-dust treatment as a reusable brand option, used sparingly when a section needs a visible break. Do not automatically replace every removed rule with animation.
- Shared implementation: `src/brand/PixelDivider.jsx` and `src/brand/pixel-divider.css`. Brighter resting dots, a 12px rhythm, softly faded ends, and sparse staggered twinkles. Reduced-motion users get still dots.
- Preserve borders that explain controls or data: input outlines, keyboard-focus indicators, graph baselines, and table structure.
- Learn removes legacy hairlines above continuation controls, around example text, takeaways, recap notes, score details, and decorative card dividers. Existing pixel section dividers remain available.
