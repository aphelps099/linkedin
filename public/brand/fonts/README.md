# LinkedIn Beats type system

Font roles are defined in `src/brand/type-system.css`. Replace `--lb-font-headline` and `--lb-weight-headline` there to swap Tobias without changing the page layouts.

- Tobias Medium: headlines. Source: `aphelps099/tfg-brand/Tobias-Medium.woff` and matching copies in the user's repositories; catalog face-257 (non-trial).
- Druk Heavy: uppercase section headings. Source: `aphelps099/look-serious/assets/home2/fonts/Druk-Heavy-Web.ttf`.
- Astro Nebula Light: BEATS and STORE markers. Source: `aphelps099/look/source-files/assets/fonts/Astro-Nebula-Light.otf`.
- Azeret Mono: small labels and numeric details. Source: `google/fonts/ofl/azeretmono/AzeretMono[wght].ttf`; the SIL Open Font License is included alongside the font.
- Current homepage headline trial: Azeret Mono Semibold (600), scoped in `src/home-2/azeret-headings.css` to the hero, certification, store, LinkedInifier, newsletter, and carousel headings. The iPod area and card artwork retain their established type. Compact outlined Astro category pills are shared by BEATS and STORE through `src/brand/category-pill.css`.
- TT Hoves continues as the body font. Founders Grotesk Mono Trial Medium is the sitewide navigation face, shared through `src/brand/navigation.css` (including dropdowns and mobile menus). Logos, product artwork and certificate artwork retain their original lettering.

The four webfonts are WOFF2 conversions of the reviewed files with their complete glyph sets preserved.

## Editorial homepage studies

The earlier `/?type=editorial` and `/?type=founders` studies retain their Founders body treatment and shared Founders Mono navigation. The active Azeret headline trial currently overlays their main headings too; the earlier Alpina and Founders heading rules remain in `editorial-type-preview.css` for comparison later. Carousel captions remain Founders.

The trial files come from the user's repository font catalog: face-56 (Founders Regular), face-60 (Founders Semibold), face-66 (Founders Mono Medium), and face-78 (GT Alpina TW Light Italic). WOFF2 conversion preserves each original file's complete glyph set. Founders trial files have a limited character set; TT Hoves, Azeret and the navigation’s monospace fallback provide punctuation/numeral fallbacks.
