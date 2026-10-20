# The Cutting Room

Unlisted catalog at `/cutting-room/`. No public nav or sitemap entry. HTML and server responses send noindex. **This is not password protection.** Anyone with the link can view the footage.

## Reuse

Search cast, scene descriptions, and recovered scripted dialogue. Filter older versions or review flags. The shortlist and notes are local to the browser; JSON export preserves a portable edit list. Only an opened clip creates a video element. Images are lazy loaded and the grid is paginated.

## Media

Existing public site media keeps its existing URLs. Recovered masters and source takes live in the `cutting-room` object-storage bucket in the site's existing Railway project. `/api/cutting-room/media/:key` issues a one-hour signed playback/download URL. There are no signed URLs or storage keys in the browser bundle. URLs contain a content hash so revisions never replace cached media.

Uploads require `CATALOG_UPLOAD_TOKEN` via Bearer header. Credentials are service-side Railway bucket variable references. Never commit credentials or signed source URLs. Max upload 300 MiB. No list/delete endpoint is exposed.

`catalog.json` is the browsable metadata. `scripts/build-cutting-room-catalog.py` regenerates it and posters from a recovered workspace. Original source hashes and task IDs are retained where available. 152 records were recovered on October 20, 2026, including earlier versions and source masters. This is not a claim that every unreferenced historical Runway generation has been recovered or frame-by-frame approved.

## Character continuity

Synergy and Synthia use the approved ivory/chrome designs and readable name badges. The black face screen contains two green eyes and a fixed-height horizontal mouth row. Speech brightness scrolls left to right; never vertically expands or warps the metal. Humans need small natural movements, attached mouths, and the matching voice. Printer pages travel outward onto a supported surface. Droid size must remain consistent.

## Current film

V6 restores the sign-installation arrival, printed banner setup, and measuring. It keeps the existing 720p music/dialogue mix, ends on the office applause, and omits the end card and tagline. No new Runway generation was used.

The Circle Back correction adds a 153rd record. Only Synergy's tile uses the
approved camera v2 footage and tracked horizontal speech row. The full 90-second
soundtrack is packet-identical to the original. Other cameras and speaker borders
retain their original pixels before delivery compression. The older cut remains
available under Earlier versions. Rebuild with `scripts/recut-circle-back-synergy.py`;
production checks are in `assets/film-corrections/circle-back-synergy/edit-proof.json`.

Training 02: Caffeinated Edition adds a 50-second current edit and two reusable
Synergy performance plates. The original training remains under Earlier versions.
The recut has an original jazzy beat, approved digital voice, fast ChatGPT typing,
coffee cups and a tracked horizontal speech display. Rebuild instructions are in
`scripts/training_02/README.md`; continuity and delivery checks are in
`assets/film-corrections/training-02/`.
